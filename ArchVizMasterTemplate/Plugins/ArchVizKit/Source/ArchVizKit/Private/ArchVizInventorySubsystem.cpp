#include "ArchVizInventorySubsystem.h"

#include "ArchVizKit.h"
#include "ArchVizProjectAsset.h"
#include "ArchVizSaveGame.h"
#include "ArchVizSettings.h"
#include "Algo/Reverse.h"
#include "Dom/JsonObject.h"
#include "Dom/JsonValue.h"
#include "Engine/DataTable.h"
#include "HttpModule.h"
#include "Interfaces/IHttpRequest.h"
#include "Interfaces/IHttpResponse.h"
#include "JsonObjectConverter.h"
#include "Kismet/GameplayStatics.h"
#include "Serialization/JsonReader.h"
#include "Serialization/JsonSerializer.h"

const FString UArchVizInventorySubsystem::SaveSlotName = TEXT("ArchVizKit_Favorites");

void UArchVizInventorySubsystem::Initialize(FSubsystemCollectionBase& Collection)
{
	Super::Initialize(Collection);

	if (const UArchVizSettings* Settings = UArchVizSettings::Get())
	{
		Project = Settings->ProjectAsset.LoadSynchronous();
	}

	if (Project)
	{
		LoadInventory(Project->UnitsTable.LoadSynchronous(), Project->UnitTypesTable.LoadSynchronous());
	}
	else
	{
		UE_LOG(LogArchViz, Warning, TEXT("No project asset set in Project Settings > Plugins > ArchViz Kit."));
	}

	LoadFavorites();
}

void UArchVizInventorySubsystem::LoadInventory(UDataTable* UnitsTable, UDataTable* UnitTypesTable)
{
	Units.Reset();
	UnitOrder.Reset();
	UnitTypes.Reset();

	if (UnitsTable)
	{
		if (!UnitsTable->GetRowStruct() || !UnitsTable->GetRowStruct()->IsChildOf(FArchVizUnitRow::StaticStruct()))
		{
			UE_LOG(LogArchViz, Error, TEXT("%s does not use the ArchVizUnitRow row struct."), *UnitsTable->GetName());
		}
		else
		{
			UnitsTable->ForeachRow<FArchVizUnitRow>(TEXT("ArchVizInventory"), [this](const FName& RowName, const FArchVizUnitRow& Row)
			{
				FArchVizUnitRow Copy = Row;
				if (Copy.UnitId.IsNone())
				{
					Copy.UnitId = RowName;
				}
				if (!Units.Contains(Copy.UnitId))
				{
					UnitOrder.Add(Copy.UnitId);
				}
				Units.Add(Copy.UnitId, MoveTemp(Copy));
			});
		}
	}

	if (UnitTypesTable)
	{
		if (!UnitTypesTable->GetRowStruct() || !UnitTypesTable->GetRowStruct()->IsChildOf(FArchVizUnitTypeRow::StaticStruct()))
		{
			UE_LOG(LogArchViz, Error, TEXT("%s does not use the ArchVizUnitTypeRow row struct."), *UnitTypesTable->GetName());
		}
		else
		{
			UnitTypesTable->ForeachRow<FArchVizUnitTypeRow>(TEXT("ArchVizInventory"), [this](const FName& RowName, const FArchVizUnitTypeRow& Row)
			{
				UnitTypes.Add(RowName, Row);
			});
		}
	}

	UE_LOG(LogArchViz, Log, TEXT("Inventory loaded: %d units, %d unit types."), Units.Num(), UnitTypes.Num());

	RecomputeActiveResults();
	OnInventoryChanged.Broadcast();
	if (bFilterActive)
	{
		OnResultsChanged.Broadcast(ActiveResults);
	}
}

bool UArchVizInventorySubsystem::GetUnit(FName UnitId, FArchVizUnitRow& OutUnit) const
{
	if (const FArchVizUnitRow* Found = Units.Find(UnitId))
	{
		OutUnit = *Found;
		return true;
	}
	return false;
}

bool UArchVizInventorySubsystem::GetUnitType(FName UnitTypeId, FArchVizUnitTypeRow& OutUnitType) const
{
	if (const FArchVizUnitTypeRow* Found = UnitTypes.Find(UnitTypeId))
	{
		OutUnitType = *Found;
		return true;
	}
	return false;
}

TArray<FArchVizUnitRow> UArchVizInventorySubsystem::GetAllUnits() const
{
	TArray<FArchVizUnitRow> Result;
	Result.Reserve(UnitOrder.Num());
	for (const FName& Id : UnitOrder)
	{
		Result.Add(Units.FindChecked(Id));
	}
	return Result;
}

bool UArchVizInventorySubsystem::MatchesFilter(const FArchVizUnitRow& U, const FArchVizUnitFilter& F) const
{
	if (F.Buildings.Num() > 0 && !F.Buildings.Contains(U.Building)) return false;
	if (F.Rooms.Num() > 0 && !F.Rooms.Contains(U.Rooms)) return false;
	if (F.Floors.Num() > 0 && !F.Floors.Contains(U.Floor)) return false;
	if (F.MinArea > 0.f && U.Area < F.MinArea) return false;
	if (F.MaxArea > 0.f && U.Area > F.MaxArea) return false;
	if (F.MinPrice > 0 && U.Price < F.MinPrice) return false;
	if (F.MaxPrice > 0 && U.Price > F.MaxPrice) return false;
	if (F.bRequireTerrace && !U.HasTerrace()) return false;
	if (F.bRequireWhiteBox && !U.bWhiteBox) return false;
	if (F.Statuses.Num() > 0 && !F.Statuses.Contains(U.Status)) return false;
	if (F.bFavoritesOnly && !Favorites.Contains(U.UnitId)) return false;

	for (const FName& Tag : F.RequiredTags)
	{
		if (!U.Tags.Contains(Tag)) return false;
	}
	return true;
}

TArray<FArchVizUnitRow> UArchVizInventorySubsystem::QueryUnits(const FArchVizUnitFilter& Filter) const
{
	TArray<FArchVizUnitRow> Result;
	for (const FName& Id : UnitOrder)
	{
		const FArchVizUnitRow& Unit = Units.FindChecked(Id);
		if (MatchesFilter(Unit, Filter))
		{
			Result.Add(Unit);
		}
	}
	SortUnits(Result, Filter.SortBy, Filter.bSortDescending);
	return Result;
}

void UArchVizInventorySubsystem::SortUnits(TArray<FArchVizUnitRow>& InOut, EArchVizSortKey Key, bool bDescending) const
{
	if (Key == EArchVizSortKey::Id)
	{
		// Table order is the developer's own ordering; just honour the direction.
		if (bDescending)
		{
			Algo::Reverse(InOut);
		}
		return;
	}

	auto Less = [Key](const FArchVizUnitRow& A, const FArchVizUnitRow& B)
	{
		switch (Key)
		{
		case EArchVizSortKey::Price: return A.Price < B.Price;
		case EArchVizSortKey::Area:  return A.Area < B.Area;
		case EArchVizSortKey::Floor: return A.Floor < B.Floor;
		case EArchVizSortKey::Rooms: return A.Rooms < B.Rooms;
		default:                     return false;
		}
	};

	InOut.StableSort([&Less, bDescending](const FArchVizUnitRow& A, const FArchVizUnitRow& B)
	{
		return bDescending ? Less(B, A) : Less(A, B);
	});
}

void UArchVizInventorySubsystem::SetActiveFilter(const FArchVizUnitFilter& Filter)
{
	ActiveFilter = Filter;
	bFilterActive = true;
	RecomputeActiveResults();
	OnResultsChanged.Broadcast(ActiveResults);
}

void UArchVizInventorySubsystem::ClearActiveFilter()
{
	ActiveFilter = FArchVizUnitFilter();
	bFilterActive = false;
	ActiveResults.Reset();
	OnResultsChanged.Broadcast(ActiveResults);
}

void UArchVizInventorySubsystem::RecomputeActiveResults()
{
	ActiveResults.Reset();
	if (!bFilterActive)
	{
		return;
	}
	for (const FArchVizUnitRow& Unit : QueryUnits(ActiveFilter))
	{
		ActiveResults.Add(Unit.UnitId);
	}
}

FArchVizInventoryRanges UArchVizInventorySubsystem::GetRanges() const
{
	FArchVizInventoryRanges R;
	bool bFirst = true;
	for (const FName& Id : UnitOrder)
	{
		const FArchVizUnitRow& U = Units.FindChecked(Id);
		if (bFirst)
		{
			R.MinArea = R.MaxArea = U.Area;
			R.MinPrice = R.MaxPrice = U.Price;
			R.MinFloor = R.MaxFloor = U.Floor;
			bFirst = false;
		}
		R.MinArea = FMath::Min(R.MinArea, U.Area);
		R.MaxArea = FMath::Max(R.MaxArea, U.Area);
		R.MinPrice = FMath::Min(R.MinPrice, U.Price);
		R.MaxPrice = FMath::Max(R.MaxPrice, U.Price);
		R.MinFloor = FMath::Min(R.MinFloor, U.Floor);
		R.MaxFloor = FMath::Max(R.MaxFloor, U.Floor);
		R.Buildings.AddUnique(U.Building);
		R.RoomCounts.AddUnique(U.Rooms);
	}
	R.Buildings.Sort(FNameLexicalLess());
	R.RoomCounts.Sort();
	return R;
}

int32 UArchVizInventorySubsystem::ApplyJsonUpdate(const FString& JsonArray)
{
	TArray<TSharedPtr<FJsonValue>> Items;
	{
		const TSharedRef<TJsonReader<>> Reader = TJsonReaderFactory<>::Create(JsonArray);
		if (!FJsonSerializer::Deserialize(Reader, Items))
		{
			// Also accept { "units": [ ... ] }.
			TSharedPtr<FJsonObject> Root;
			const TSharedRef<TJsonReader<>> ObjectReader = TJsonReaderFactory<>::Create(JsonArray);
			if (!FJsonSerializer::Deserialize(ObjectReader, Root) || !Root.IsValid() || !Root->HasTypedField<EJson::Array>(TEXT("units")))
			{
				UE_LOG(LogArchViz, Warning, TEXT("ApplyJsonUpdate: expected a JSON array of units or {\"units\": [...]}."));
				return 0;
			}
			Items = Root->GetArrayField(TEXT("units"));
		}
	}

	int32 Count = 0;
	for (const TSharedPtr<FJsonValue>& Item : Items)
	{
		const TSharedPtr<FJsonObject>* Obj = nullptr;
		if (!Item.IsValid() || !Item->TryGetObject(Obj) || !Obj || !Obj->IsValid())
		{
			continue;
		}

		FString IdString;
		if (!(*Obj)->TryGetStringField(TEXT("UnitId"), IdString) || IdString.IsEmpty())
		{
			continue;
		}

		const FName Id(*IdString);
		const FArchVizUnitRow* Existing = Units.Find(Id);
		const bool bIsNew = (Existing == nullptr);
		FArchVizUnitRow Row = Existing ? *Existing : FArchVizUnitRow();

		// Only the fields present in the JSON object are overwritten.
		if (!FJsonObjectConverter::JsonObjectToUStruct((*Obj).ToSharedRef(), &Row))
		{
			UE_LOG(LogArchViz, Warning, TEXT("ApplyJsonUpdate: could not parse unit %s."), *IdString);
			continue;
		}

		Row.UnitId = Id;
		if (bIsNew)
		{
			UnitOrder.Add(Id);
		}
		Units.Add(Id, MoveTemp(Row));
		++Count;
	}

	if (Count > 0)
	{
		RecomputeActiveResults();
		OnInventoryChanged.Broadcast();
		if (bFilterActive)
		{
			OnResultsChanged.Broadcast(ActiveResults);
		}
	}
	return Count;
}

void UArchVizInventorySubsystem::RefreshFromUrl()
{
	if (!Project || Project->InventorySyncUrl.IsEmpty())
	{
		return;
	}

	auto Request = FHttpModule::Get().CreateRequest();
	Request->SetURL(Project->InventorySyncUrl);
	Request->SetVerb(TEXT("GET"));
	Request->SetHeader(TEXT("Accept"), TEXT("application/json"));

	TWeakObjectPtr<UArchVizInventorySubsystem> WeakThis(this);
	Request->OnProcessRequestComplete().BindLambda([WeakThis](FHttpRequestPtr, FHttpResponsePtr Response, bool bSucceeded)
	{
		if (!WeakThis.IsValid())
		{
			return;
		}
		if (!bSucceeded || !Response.IsValid() || !EHttpResponseCodes::IsOk(Response->GetResponseCode()))
		{
			UE_LOG(LogArchViz, Warning, TEXT("Inventory sync failed (%d)."), Response.IsValid() ? Response->GetResponseCode() : 0);
			return;
		}
		const int32 Updated = WeakThis->ApplyJsonUpdate(Response->GetContentAsString());
		UE_LOG(LogArchViz, Log, TEXT("Inventory sync: %d units updated."), Updated);
	});
	Request->ProcessRequest();
}

void UArchVizInventorySubsystem::SetFavorite(FName UnitId, bool bFavorite)
{
	if (UnitId.IsNone() || Favorites.Contains(UnitId) == bFavorite)
	{
		return;
	}

	if (bFavorite)
	{
		Favorites.Add(UnitId);
	}
	else
	{
		Favorites.Remove(UnitId);
	}

	SaveFavorites();
	if (bFilterActive && ActiveFilter.bFavoritesOnly)
	{
		RecomputeActiveResults();
		OnResultsChanged.Broadcast(ActiveResults);
	}
	OnFavoritesChanged.Broadcast();
}

bool UArchVizInventorySubsystem::ToggleFavorite(FName UnitId)
{
	const bool bNewValue = !IsFavorite(UnitId);
	SetFavorite(UnitId, bNewValue);
	return bNewValue;
}

void UArchVizInventorySubsystem::ClearFavorites()
{
	if (Favorites.Num() == 0)
	{
		return;
	}
	Favorites.Reset();
	SaveFavorites();
	if (bFilterActive && ActiveFilter.bFavoritesOnly)
	{
		RecomputeActiveResults();
		OnResultsChanged.Broadcast(ActiveResults);
	}
	OnFavoritesChanged.Broadcast();
}

void UArchVizInventorySubsystem::LoadFavorites()
{
	Favorites.Reset();
	if (!UGameplayStatics::DoesSaveGameExist(SaveSlotName, 0))
	{
		return;
	}
	if (const UArchVizSaveGame* Save = Cast<UArchVizSaveGame>(UGameplayStatics::LoadGameFromSlot(SaveSlotName, 0)))
	{
		Favorites.Append(Save->Favorites);
	}
}

void UArchVizInventorySubsystem::SaveFavorites() const
{
	UArchVizSaveGame* Save = Cast<UArchVizSaveGame>(UGameplayStatics::CreateSaveGameObject(UArchVizSaveGame::StaticClass()));
	if (!Save)
	{
		return;
	}
	Save->Favorites = Favorites.Array();
	UGameplayStatics::AsyncSaveGameToSlot(Save, SaveSlotName, 0);
}
