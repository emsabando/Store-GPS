#include "ArchVizAppSubsystem.h"

#include "ArchVizBlueprintLibrary.h"
#include "ArchVizCameraPawn.h"
#include "ArchVizCameraShot.h"
#include "ArchVizEnvironment.h"
#include "ArchVizInventorySubsystem.h"
#include "ArchVizKit.h"
#include "ArchVizPOI.h"
#include "ArchVizProjectAsset.h"
#include "ArchVizSceneSubsystem.h"
#include "Dom/JsonObject.h"
#include "Dom/JsonValue.h"
#include "Engine/GameInstance.h"
#include "Engine/LatentActionManager.h"
#include "Engine/World.h"
#include "GameFramework/PlayerController.h"
#include "HttpModule.h"
#include "Interfaces/IHttpRequest.h"
#include "Interfaces/IHttpResponse.h"
#include "Internationalization/Culture.h"
#include "Internationalization/Internationalization.h"
#include "JsonObjectConverter.h"
#include "Kismet/GameplayStatics.h"
#include "Policies/CondensedJsonPrintPolicy.h"
#include "Serialization/JsonReader.h"
#include "Serialization/JsonSerializer.h"
#include "Serialization/JsonWriter.h"
#include "TimerManager.h"

namespace
{
	template <typename TEnum>
	FString EnumToString(TEnum Value)
	{
		return StaticEnum<TEnum>()->GetNameStringByValue(static_cast<int64>(Value));
	}

	template <typename TEnum>
	bool StringToEnum(const FString& String, TEnum& OutValue)
	{
		const int64 Value = StaticEnum<TEnum>()->GetValueByNameString(String);
		if (Value == INDEX_NONE)
		{
			return false;
		}
		OutValue = static_cast<TEnum>(Value);
		return true;
	}

	/** Naming convention for optional authored shots: Building_B1, Section_B1, Unit_345. */
	FName ConventionShot(const TCHAR* Prefix, FName Id)
	{
		return FName(*FString::Printf(TEXT("%s_%s"), Prefix, *Id.ToString()));
	}

	FString NameToJson(FName Name)
	{
		return Name.IsNone() ? FString() : Name.ToString();
	}
}

// --- Lifecycle ------------------------------------------------------------------

void UArchVizAppSubsystem::Initialize(FSubsystemCollectionBase& Collection)
{
	Collection.InitializeDependency(UArchVizInventorySubsystem::StaticClass());
	Super::Initialize(Collection);

	if (UArchVizInventorySubsystem* Inventory = GetInventory())
	{
		Inventory->OnResultsChanged.AddDynamic(this, &UArchVizAppSubsystem::HandleResultsChanged);
		Inventory->OnFavoritesChanged.AddDynamic(this, &UArchVizAppSubsystem::HandleFavoritesChanged);
	}

	LastActivityTime = FPlatformTime::Seconds();
	GetGameInstance()->GetTimerManager().SetTimer(IdleTimer, FTimerDelegate::CreateUObject(this, &UArchVizAppSubsystem::CheckIdle), 1.f, true);
}

void UArchVizAppSubsystem::Deinitialize()
{
	if (UGameInstance* GameInstance = GetGameInstance())
	{
		GameInstance->GetTimerManager().ClearTimer(IdleTimer);
	}
	if (UArchVizInventorySubsystem* Inventory = GetInventory())
	{
		Inventory->OnResultsChanged.RemoveDynamic(this, &UArchVizAppSubsystem::HandleResultsChanged);
		Inventory->OnFavoritesChanged.RemoveDynamic(this, &UArchVizAppSubsystem::HandleFavoritesChanged);
	}
	Super::Deinitialize();
}

// --- Accessors --------------------------------------------------------------------

UWorld* UArchVizAppSubsystem::GetCurrentWorld() const
{
	const UGameInstance* GameInstance = GetGameInstance();
	return GameInstance ? GameInstance->GetWorld() : nullptr;
}

UArchVizSceneSubsystem* UArchVizAppSubsystem::GetScene() const
{
	const UWorld* World = GetCurrentWorld();
	return World ? World->GetSubsystem<UArchVizSceneSubsystem>() : nullptr;
}

UArchVizInventorySubsystem* UArchVizAppSubsystem::GetInventory() const
{
	const UGameInstance* GameInstance = GetGameInstance();
	return GameInstance ? GameInstance->GetSubsystem<UArchVizInventorySubsystem>() : nullptr;
}

AArchVizCameraPawn* UArchVizAppSubsystem::GetCameraPawn() const
{
	if (SavedCameraPawn.IsValid())
	{
		return SavedCameraPawn.Get(); // in first person the camera pawn is parked, not possessed
	}
	return Cast<AArchVizCameraPawn>(UGameplayStatics::GetPlayerPawn(GetCurrentWorld(), 0));
}

AArchVizEnvironment* UArchVizAppSubsystem::GetEnvironment() const
{
	return Cast<AArchVizEnvironment>(UGameplayStatics::GetActorOfClass(GetCurrentWorld(), AArchVizEnvironment::StaticClass()));
}

// --- State machine ------------------------------------------------------------------

void UArchVizAppSubsystem::PushHistory()
{
	// A first-person screen cannot be restored without its walker pawn; Back skips over it.
	if (State.Mode == EArchVizMode::FirstPerson)
	{
		return;
	}

	FHistoryEntry Entry;
	Entry.State = State;
	if (const AArchVizCameraPawn* Camera = GetCameraPawn())
	{
		Entry.bHasCamera = true;
		Camera->GetOrbit(Entry.Pivot, Entry.Yaw, Entry.Pitch, Entry.Arm, Entry.FOV, Entry.bLookAround);
	}
	History.Add(Entry);

	constexpr int32 MaxHistory = 32;
	if (History.Num() > MaxHistory)
	{
		History.RemoveAt(0);
	}
}

void UArchVizAppSubsystem::SetState(const FArchVizAppState& NewState, bool bPushHistory)
{
	if (bPushHistory)
	{
		PushHistory();
	}

	const FArchVizAppState OldState = State;
	State = NewState;
	ApplySceneForState(OldState);

	if (OldState.Mode != State.Mode)
	{
		OnModeChanged.Broadcast(State.Mode, OldState.Mode);
	}
	OnStateChanged.Broadcast();
	SendStateToUI();
}

void UArchVizAppSubsystem::ApplySceneForState(const FArchVizAppState& OldState)
{
	if (UArchVizSceneSubsystem* Scene = GetScene())
	{
		if (State.bSectionActive)
		{
			Scene->SetSection(State.Building, State.Floor);
		}
		else
		{
			Scene->ClearSection();
		}

		const bool bUnitMode = State.Mode == EArchVizMode::Unit || State.Mode == EArchVizMode::Interior;
		Scene->SetSelectedUnit(bUnitMode ? State.UnitId : NAME_None);

		if (OldState.PoiId != State.PoiId)
		{
			if (AArchVizPOI* OldPOI = Scene->FindPOI(OldState.PoiId))
			{
				OldPOI->SetFocused(false);
			}
			if (AArchVizPOI* NewPOI = Scene->FindPOI(State.PoiId))
			{
				NewPOI->SetFocused(true);
			}
		}
	}

	if (State.Mode == EArchVizMode::Interior)
	{
		EnsureInteriorLoaded(State.UnitId);
	}
	else if (OldState.Mode == EArchVizMode::Interior)
	{
		UnloadInterior();
	}
}

bool UArchVizAppSubsystem::FlyToShotId(FName ShotId, float Duration) const
{
	if (ShotId.IsNone())
	{
		return false;
	}
	const UArchVizSceneSubsystem* Scene = GetScene();
	AArchVizCameraShot* Shot = Scene ? Scene->FindShot(ShotId) : nullptr;
	AArchVizCameraPawn* Camera = GetCameraPawn();
	if (!Shot || !Camera)
	{
		return false;
	}
	Camera->FlyToShot(Shot, Duration);
	return true;
}

void UArchVizAppSubsystem::FrameUnit(FName UnitId) const
{
	const UArchVizSceneSubsystem* Scene = GetScene();
	AArchVizCameraPawn* Camera = GetCameraPawn();
	FBox Bounds;
	if (!Scene || !Camera || !Scene->GetUnitBounds(UnitId, Bounds))
	{
		return;
	}

	FVector Pivot;
	float Yaw, Pitch, Arm, FOV;
	bool bLookAround;
	Camera->GetOrbit(Pivot, Yaw, Pitch, Arm, FOV, bLookAround);

	// Look at the facade from outside: the camera sits beyond the unit, on the far side
	// from the current pivot (usually the building centre), looking back at it.
	const FVector Center = Bounds.GetCenter();
	FVector Outward = Center - Pivot;
	Outward.Z = 0.0;
	float NewYaw = Yaw;
	if (Outward.SizeSquared() > FMath::Square(500.0))
	{
		NewYaw = static_cast<float>(Outward.Rotation().Yaw) + 180.f;
	}

	const float Radius = static_cast<float>(Bounds.GetExtent().Size()) * 3.f;
	const float Distance = Radius / FMath::Max(FMath::Sin(FMath::DegreesToRadians(FOV * 0.5f)), 0.05f);
	const float NewPitch = bLookAround ? -15.f : FMath::Clamp(Pitch, -35.f, -8.f);
	Camera->FlyTo(Center, NewYaw, NewPitch, FMath::Clamp(Distance, Camera->MinArmLength, Camera->MaxArmLength), FOV, 1.6f, false);
}

// --- Navigation ------------------------------------------------------------------------

void UArchVizAppSubsystem::GoHome()
{
	LeaveFirstPersonIfActive();

	FArchVizAppState NewState;
	NewState.ShotId = TEXT("Home");
	SetState(NewState, State.Mode != EArchVizMode::Masterplan);
	FlyToShotId(NewState.ShotId);
}

void UArchVizAppSubsystem::Back()
{
	if (History.Num() == 0)
	{
		if (State.Mode != EArchVizMode::Masterplan)
		{
			GoHome();
		}
		return;
	}

	const FHistoryEntry Entry = History.Pop();
	LeaveFirstPersonIfActive();
	SetState(Entry.State, false);

	if (Entry.bHasCamera)
	{
		if (AArchVizCameraPawn* Camera = GetCameraPawn())
		{
			Camera->FlyTo(Entry.Pivot, Entry.Yaw, Entry.Pitch, Entry.Arm, Entry.FOV, 1.5f, Entry.bLookAround);
		}
	}
}

void UArchVizAppSubsystem::SelectBuilding(FName Building)
{
	LeaveFirstPersonIfActive();

	FArchVizAppState NewState;
	NewState.Mode = EArchVizMode::Building;
	NewState.Building = Building;
	NewState.ShotId = ConventionShot(TEXT("Building"), Building);
	SetState(NewState, true);
	FlyToShotId(NewState.ShotId);
}

void UArchVizAppSubsystem::SelectFloor(FName Building, int32 Floor)
{
	LeaveFirstPersonIfActive();

	FArchVizAppState NewState;
	NewState.Mode = EArchVizMode::Floor;
	NewState.Building = Building;
	NewState.Floor = Floor;
	NewState.bSectionActive = true;
	NewState.ShotId = ConventionShot(TEXT("Section"), Building);

	// Stepping through floors replaces the entry instead of stacking one per floor.
	SetState(NewState, State.Mode != EArchVizMode::Floor);
	FlyToShotId(NewState.ShotId);
}

void UArchVizAppSubsystem::SelectUnit(FName UnitId)
{
	const UArchVizInventorySubsystem* Inventory = GetInventory();
	FArchVizUnitRow Row;
	if (!Inventory || !Inventory->GetUnit(UnitId, Row))
	{
		UE_LOG(LogArchViz, Warning, TEXT("SelectUnit: unknown unit %s."), *UnitId.ToString());
		return;
	}
	LeaveFirstPersonIfActive();

	FArchVizAppState NewState;
	NewState.Mode = EArchVizMode::Unit;
	NewState.Building = Row.Building;
	NewState.Floor = Row.Floor;
	NewState.UnitId = UnitId;
	// Picking a unit on the cut floor keeps the cut, so the plan stays in context.
	NewState.bSectionActive = State.bSectionActive && State.Building == Row.Building && State.Floor == Row.Floor;

	// Browsing unit to unit replaces the entry; Back returns to where browsing started.
	SetState(NewState, State.Mode != EArchVizMode::Unit);

	if (!FlyToShotId(ConventionShot(TEXT("Unit"), UnitId)))
	{
		FrameUnit(UnitId);
	}
}

void UArchVizAppSubsystem::EnterInterior(FName UnitId, FName ShotId)
{
	const UArchVizInventorySubsystem* Inventory = GetInventory();
	if (UnitId.IsNone())
	{
		UnitId = State.UnitId;
	}
	FArchVizUnitRow Row;
	if (!Inventory || !Inventory->GetUnit(UnitId, Row))
	{
		UE_LOG(LogArchViz, Warning, TEXT("EnterInterior: unknown unit %s."), *UnitId.ToString());
		return;
	}
	FArchVizUnitTypeRow Type;
	Inventory->GetUnitType(Row.UnitType, Type);
	if (ShotId.IsNone() && Type.Viewpoints.Num() > 0)
	{
		ShotId = Type.Viewpoints[0].ShotId;
	}
	LeaveFirstPersonIfActive();

	FArchVizAppState NewState;
	NewState.Mode = EArchVizMode::Interior;
	NewState.Building = Row.Building;
	NewState.Floor = Row.Floor;
	NewState.UnitId = UnitId;
	NewState.ShotId = ShotId;
	PendingInteriorShot = ShotId;

	SetState(NewState, State.Mode != EArchVizMode::Interior); // may start streaming the show-flat
	if (!bInteriorLoading)
	{
		FlyToShotId(ShotId);
	}
}

void UArchVizAppSubsystem::SelectViewpoint(FName ShotId)
{
	if (State.Mode != EArchVizMode::Interior)
	{
		EnterInterior(State.UnitId, ShotId);
		return;
	}
	FArchVizAppState NewState = State;
	NewState.ShotId = ShotId;
	PendingInteriorShot = ShotId;
	SetState(NewState, false);
	if (!bInteriorLoading)
	{
		FlyToShotId(ShotId);
	}
}

void UArchVizAppSubsystem::FocusAmenity(AArchVizPOI* POI)
{
	if (!POI)
	{
		return;
	}
	LeaveFirstPersonIfActive();

	FArchVizAppState NewState;
	NewState.Mode = EArchVizMode::Amenity;
	NewState.Building = State.Building;
	NewState.PoiId = POI->PoiId;
	NewState.ShotId = POI->ShotId;
	SetState(NewState, State.Mode != EArchVizMode::Amenity);

	if (!FlyToShotId(POI->ShotId))
	{
		if (AArchVizCameraPawn* Camera = GetCameraPawn())
		{
			Camera->FrameBox(FBox::BuildAABB(POI->GetActorLocation(), FVector(1500.0)), 1.6f, 1.2f);
		}
	}
}

void UArchVizAppSubsystem::FocusAmenityById(FName PoiId)
{
	if (const UArchVizSceneSubsystem* Scene = GetScene())
	{
		FocusAmenity(Scene->FindPOI(PoiId));
	}
}

void UArchVizAppSubsystem::EnterFirstPerson(FTransform Start)
{
	UWorld* World = GetCurrentWorld();
	APlayerController* PC = UGameplayStatics::GetPlayerController(World, 0);
	const UArchVizInventorySubsystem* Inventory = GetInventory();
	const UArchVizProjectAsset* Project = Inventory ? Inventory->GetProject() : nullptr;
	UClass* PawnClass = Project ? Project->FirstPersonPawnClass.LoadSynchronous() : nullptr;
	if (!World || !PC || !PawnClass)
	{
		UE_LOG(LogArchViz, Warning, TEXT("EnterFirstPerson: set First Person Pawn Class in the project asset."));
		return;
	}

	LeaveFirstPersonIfActive();
	AArchVizCameraPawn* Camera = Cast<AArchVizCameraPawn>(PC->GetPawn());

	FActorSpawnParameters Params;
	Params.SpawnCollisionHandlingOverride = ESpawnActorCollisionHandlingMethod::AdjustIfPossibleButAlwaysSpawn;
	APawn* Walker = World->SpawnActor<APawn>(PawnClass, Start, Params);
	if (!Walker)
	{
		return;
	}

	FArchVizAppState NewState = State;
	NewState.Mode = EArchVizMode::FirstPerson;
	PushHistory(); // captures the orbit view to return to
	SavedCameraPawn = Camera;
	FirstPersonPawn = Walker;
	PC->Possess(Walker);
	SetState(NewState, false);
}

void UArchVizAppSubsystem::EnterFirstPersonAtPOI(AArchVizPOI* POI)
{
	if (POI && POI->FirstPersonStart)
	{
		EnterFirstPerson(POI->FirstPersonStart->GetActorTransform());
	}
}

void UArchVizAppSubsystem::ExitFirstPerson()
{
	if (State.Mode == EArchVizMode::FirstPerson && History.Num() > 0)
	{
		Back(); // restores the screen and orbit view from before first person
		return;
	}
	LeaveFirstPersonIfActive();
	GoHome();
}

void UArchVizAppSubsystem::LeaveFirstPersonIfActive()
{
	if (!FirstPersonPawn.IsValid() && !SavedCameraPawn.IsValid())
	{
		return;
	}
	if (APlayerController* PC = UGameplayStatics::GetPlayerController(GetCurrentWorld(), 0))
	{
		if (SavedCameraPawn.IsValid())
		{
			PC->Possess(SavedCameraPawn.Get());
		}
	}
	if (FirstPersonPawn.IsValid())
	{
		FirstPersonPawn->Destroy();
	}
	FirstPersonPawn.Reset();
	SavedCameraPawn.Reset();
}

void UArchVizAppSubsystem::GoToShot(FName ShotId, float Duration)
{
	if (FlyToShotId(ShotId, Duration))
	{
		FArchVizAppState NewState = State;
		NewState.ShotId = ShotId;
		SetState(NewState, false);
	}
}

void UArchVizAppSubsystem::SetUIHidden(bool bHidden)
{
	bUIHidden = bHidden;
	if (UArchVizSceneSubsystem* Scene = GetScene())
	{
		Scene->SetPOIsVisible(!bHidden);
	}
	OnUIHiddenChanged.Broadcast(bHidden);
	SendStateToUI();
}

// --- Interior streaming ------------------------------------------------------------------

void UArchVizAppSubsystem::EnsureInteriorLoaded(FName UnitId)
{
	const UArchVizInventorySubsystem* Inventory = GetInventory();
	FArchVizUnitRow Row;
	FArchVizUnitTypeRow Type;
	const bool bHasLevel = Inventory && Inventory->GetUnit(UnitId, Row) && Inventory->GetUnitType(Row.UnitType, Type) && !Type.InteriorLevel.IsNull();

	if (!bHasLevel)
	{
		// Show-flat lives in the persistent level (or a data layer): nothing to stream.
		UnloadInterior();
		return;
	}
	if (LoadedInterior == Type.InteriorLevel)
	{
		return;
	}

	UnloadInterior();
	LoadedInterior = Type.InteriorLevel;

	FLatentActionInfo Latent;
	Latent.CallbackTarget = this;
	Latent.ExecutionFunction = GET_FUNCTION_NAME_CHECKED(UArchVizAppSubsystem, HandleInteriorLoaded);
	Latent.UUID = ++LatentCounter;
	Latent.Linkage = 0;
	bInteriorLoading = true;
	UGameplayStatics::LoadStreamLevelBySoftObjectPtr(GetCurrentWorld(), LoadedInterior, true, false, Latent);
}

void UArchVizAppSubsystem::HandleInteriorLoaded()
{
	bInteriorLoading = false;
	if (State.Mode == EArchVizMode::Interior)
	{
		FlyToShotId(PendingInteriorShot); // its shot actors registered on load
	}
}

void UArchVizAppSubsystem::UnloadInterior()
{
	bInteriorLoading = false;
	if (LoadedInterior.IsNull())
	{
		return;
	}
	FLatentActionInfo Latent;
	Latent.CallbackTarget = this;
	Latent.ExecutionFunction = NAME_None;
	Latent.UUID = ++LatentCounter;
	Latent.Linkage = 0;
	UGameplayStatics::UnloadStreamLevelBySoftObjectPtr(GetCurrentWorld(), LoadedInterior, Latent, false);
	LoadedInterior.Reset();
}

// --- Scene callbacks ------------------------------------------------------------------------

void UArchVizAppSubsystem::HandleUnitClicked(FName UnitId)
{
	SelectUnit(UnitId);
}

void UArchVizAppSubsystem::HandlePOIClicked(AArchVizPOI* POI)
{
	FocusAmenity(POI);
}

// --- Kiosk --------------------------------------------------------------------------------

void UArchVizAppSubsystem::NotifyUserActivity()
{
	LastActivityTime = FPlatformTime::Seconds();
	if (!bIsIdle)
	{
		return;
	}
	bIsIdle = false;
	if (AArchVizCameraPawn* Camera = GetCameraPawn())
	{
		Camera->SetAutoRotate(false);
	}
	OnIdleChanged.Broadcast(false);
	SendStateToUI();
}

void UArchVizAppSubsystem::CheckIdle()
{
	const UArchVizInventorySubsystem* Inventory = GetInventory();
	const UArchVizProjectAsset* Project = Inventory ? Inventory->GetProject() : nullptr;
	const float Timeout = Project ? Project->IdleTimeoutSeconds : 0.f;
	if (bIsIdle || Timeout <= 0.f || FPlatformTime::Seconds() - LastActivityTime < Timeout)
	{
		return;
	}

	bIsIdle = true;
	if (bResetSessionOnIdle)
	{
		ResetSession();
	}
	if (bAutoRotateWhenIdle)
	{
		if (AArchVizCameraPawn* Camera = GetCameraPawn())
		{
			Camera->SetAutoRotate(true, 4.f);
		}
	}
	OnIdleChanged.Broadcast(true);
	SendStateToUI();
}

void UArchVizAppSubsystem::ResetSession()
{
	LeaveFirstPersonIfActive();
	if (UArchVizInventorySubsystem* Inventory = GetInventory())
	{
		Inventory->ClearActiveFilter();
		Inventory->ClearFavorites();
	}
	if (bUIHidden)
	{
		SetUIHidden(false);
	}
	GoHome();
	History.Reset(); // the next visitor starts fresh
	SendStateToUI();
}

// --- Bridge ----------------------------------------------------------------------------------

bool UArchVizAppSubsystem::HandleCommandJson(const FString& Json)
{
	TSharedPtr<FJsonObject> Obj;
	const TSharedRef<TJsonReader<>> Reader = TJsonReaderFactory<>::Create(Json);
	if (!FJsonSerializer::Deserialize(Reader, Obj) || !Obj.IsValid())
	{
		UE_LOG(LogArchViz, Warning, TEXT("HandleCommandJson: not a JSON object: %s"), *Json);
		return false;
	}

	NotifyUserActivity();

	auto Str = [&Obj](const TCHAR* Field) { FString V; Obj->TryGetStringField(Field, V); return V; };
	auto Name = [&Str](const TCHAR* Field) { const FString V = Str(Field); return V.IsEmpty() ? FName() : FName(*V); };
	auto Num = [&Obj](const TCHAR* Field, double Default) { double V = Default; Obj->TryGetNumberField(Field, V); return V; };
	auto Bool = [&Obj](const TCHAR* Field, bool Default) { bool V = Default; Obj->TryGetBoolField(Field, V); return V; };

	UArchVizInventorySubsystem* Inventory = GetInventory();
	UArchVizSceneSubsystem* Scene = GetScene();
	AArchVizEnvironment* Environment = GetEnvironment();
	const FString Cmd = Str(TEXT("cmd"));

	// FString comparisons are case-insensitive, so "selectUnit" and "selectunit" both work.
	if (Cmd == TEXT("home")) { GoHome(); }
	else if (Cmd == TEXT("back")) { Back(); }
	else if (Cmd == TEXT("selectBuilding")) { SelectBuilding(Name(TEXT("building"))); }
	else if (Cmd == TEXT("selectFloor")) { SelectFloor(Name(TEXT("building")), static_cast<int32>(Num(TEXT("floor"), 0))); }
	else if (Cmd == TEXT("clearSection"))
	{
		FArchVizAppState NewState = State;
		NewState.bSectionActive = false;
		if (NewState.Mode == EArchVizMode::Floor)
		{
			NewState.Mode = EArchVizMode::Building;
		}
		SetState(NewState, false);
	}
	else if (Cmd == TEXT("selectUnit")) { SelectUnit(Name(TEXT("unitId"))); }
	else if (Cmd == TEXT("enterInterior")) { EnterInterior(Name(TEXT("unitId")), Name(TEXT("shotId"))); }
	else if (Cmd == TEXT("selectViewpoint")) { SelectViewpoint(Name(TEXT("shotId"))); }
	else if (Cmd == TEXT("focusAmenity")) { FocusAmenityById(Name(TEXT("poiId"))); }
	else if (Cmd == TEXT("firstPerson"))
	{
		const FName PoiId = Obj->HasField(TEXT("poiId")) ? Name(TEXT("poiId")) : State.PoiId;
		EnterFirstPersonAtPOI(Scene ? Scene->FindPOI(PoiId) : nullptr);
	}
	else if (Cmd == TEXT("exitFirstPerson")) { ExitFirstPerson(); }
	else if (Cmd == TEXT("goToShot")) { GoToShot(Name(TEXT("shotId")), static_cast<float>(Num(TEXT("duration"), -1.0))); }
	else if (Cmd == TEXT("setFilter") || Cmd == TEXT("queryUnits"))
	{
		FArchVizUnitFilter Filter;
		const TSharedPtr<FJsonObject>* FilterObj = nullptr;
		if (Obj->TryGetObjectField(TEXT("filter"), FilterObj) && FilterObj && FilterObj->IsValid())
		{
			FJsonObjectConverter::JsonObjectToUStruct((*FilterObj).ToSharedRef(), &Filter);
		}
		if (Inventory)
		{
			if (Cmd == TEXT("setFilter"))
			{
				Inventory->SetActiveFilter(Filter); // results message follows via OnResultsChanged
			}
			SendUnits(Inventory->QueryUnits(Filter), TEXT("units"));
		}
	}
	else if (Cmd == TEXT("clearFilter")) { if (Inventory) { Inventory->ClearActiveFilter(); } }
	else if (Cmd == TEXT("getUnit"))
	{
		FArchVizUnitRow Row;
		if (Inventory && Inventory->GetUnit(Name(TEXT("unitId")), Row))
		{
			TSharedRef<FJsonObject> Msg = MakeShared<FJsonObject>();
			Msg->SetStringField(TEXT("type"), TEXT("unit"));
			if (TSharedPtr<FJsonObject> UnitJson = FJsonObjectConverter::UStructToJsonObject(Row))
			{
				UnitJson->SetBoolField(TEXT("favorite"), Inventory->IsFavorite(Row.UnitId));
				Msg->SetObjectField(TEXT("unit"), UnitJson);
			}
			FArchVizUnitTypeRow Type;
			if (Inventory->GetUnitType(Row.UnitType, Type))
			{
				Msg->SetObjectField(TEXT("unitType"), FJsonObjectConverter::UStructToJsonObject(Type));
			}
			SendMessage(Msg);
		}
	}
	else if (Cmd == TEXT("getRanges"))
	{
		if (Inventory)
		{
			TSharedRef<FJsonObject> Msg = MakeShared<FJsonObject>();
			Msg->SetStringField(TEXT("type"), TEXT("ranges"));
			Msg->SetObjectField(TEXT("ranges"), FJsonObjectConverter::UStructToJsonObject(Inventory->GetRanges()));
			SendMessage(Msg);
		}
	}
	else if (Cmd == TEXT("toggleFavorite")) { if (Inventory) { Inventory->ToggleFavorite(Name(TEXT("unitId"))); } }
	else if (Cmd == TEXT("setFavorite")) { if (Inventory) { Inventory->SetFavorite(Name(TEXT("unitId")), Bool(TEXT("value"), true)); } }
	else if (Cmd == TEXT("showAllStatuses")) { if (Scene) { Scene->SetShowAllStatuses(Bool(TEXT("value"), true)); } }
	else if (Cmd == TEXT("setTime")) { if (Environment) { Environment->SetTimeOfDay(static_cast<float>(Num(TEXT("hours"), 12.0)), static_cast<float>(Num(TEXT("blend"), 0.0))); } }
	else if (Cmd == TEXT("setDate")) { if (Environment) { Environment->SetDate(static_cast<int32>(Num(TEXT("month"), 6)), static_cast<int32>(Num(TEXT("day"), 21))); } }
	else if (Cmd == TEXT("setTimeLapse")) { if (Environment) { Environment->SetTimeLapse(static_cast<float>(Num(TEXT("speed"), 0.0))); } }
	else if (Cmd == TEXT("setWeather"))
	{
		EArchVizWeather Weather;
		if (Environment && StringToEnum(Str(TEXT("weather")), Weather))
		{
			Environment->SetWeather(Weather, static_cast<float>(Num(TEXT("blend"), 3.0)));
		}
	}
	else if (Cmd == TEXT("setSeason"))
	{
		EArchVizSeason Season;
		if (Environment && StringToEnum(Str(TEXT("season")), Season))
		{
			Environment->SetSeason(Season, static_cast<float>(Num(TEXT("blend"), 2.0)));
		}
	}
	else if (Cmd == TEXT("setQuality"))
	{
		EArchVizQuality Quality;
		if (StringToEnum(Str(TEXT("quality")), Quality))
		{
			UArchVizBlueprintLibrary::ApplyQualityPreset(Quality);
		}
	}
	else if (Cmd == TEXT("setLanguage")) { UArchVizBlueprintLibrary::SetLanguage(Str(TEXT("culture"))); }
	else if (Cmd == TEXT("hideUI")) { SetUIHidden(Bool(TEXT("value"), true)); }
	else if (Cmd == TEXT("screenshot")) { UArchVizBlueprintLibrary::TakeScreenshot(Bool(TEXT("withUI"), false)); }
	else if (Cmd == TEXT("submitLead"))
	{
		FArchVizLead Lead;
		Lead.Name = Str(TEXT("name"));
		Lead.Phone = Str(TEXT("phone"));
		Lead.Email = Str(TEXT("email"));
		Lead.Message = Str(TEXT("message"));
		Lead.UnitId = Name(TEXT("unitId"));
		Lead.bMarketingConsent = Bool(TEXT("consent"), false);
		SubmitLead(Lead);
	}
	else if (Cmd == TEXT("getFloors"))
	{
		TSharedRef<FJsonObject> Msg = MakeShared<FJsonObject>();
		Msg->SetStringField(TEXT("type"), TEXT("floors"));
		Msg->SetStringField(TEXT("building"), Str(TEXT("building")));
		TArray<TSharedPtr<FJsonValue>> Floors;
		if (Scene)
		{
			for (const int32 Floor : Scene->GetFloors(Name(TEXT("building"))))
			{
				Floors.Add(MakeShared<FJsonValueNumber>(Floor));
			}
		}
		Msg->SetArrayField(TEXT("floors"), Floors);
		SendMessage(Msg);
	}
	else if (Cmd == TEXT("getPOIs"))
	{
		TSharedRef<FJsonObject> Msg = MakeShared<FJsonObject>();
		Msg->SetStringField(TEXT("type"), TEXT("pois"));
		TArray<TSharedPtr<FJsonValue>> List;
		if (Scene)
		{
			for (const AArchVizPOI* POI : Scene->GetPOIs(Name(TEXT("category"))))
			{
				TSharedRef<FJsonObject> Item = MakeShared<FJsonObject>();
				Item->SetStringField(TEXT("poiId"), NameToJson(POI->PoiId));
				Item->SetStringField(TEXT("title"), POI->Title.ToString());
				Item->SetStringField(TEXT("description"), POI->Description.ToString());
				Item->SetStringField(TEXT("category"), NameToJson(POI->Category));
				Item->SetStringField(TEXT("badge"), POI->Badge.ToString());
				Item->SetStringField(TEXT("mediaUrl"), POI->MediaUrl);
				Item->SetBoolField(TEXT("hasFirstPerson"), POI->HasFirstPerson());
				List.Add(MakeShared<FJsonValueObject>(Item));
			}
		}
		Msg->SetArrayField(TEXT("pois"), List);
		SendMessage(Msg);
	}
	else if (Cmd == TEXT("getShots"))
	{
		TSharedRef<FJsonObject> Msg = MakeShared<FJsonObject>();
		Msg->SetStringField(TEXT("type"), TEXT("shots"));
		TArray<TSharedPtr<FJsonValue>> List;
		if (Scene)
		{
			for (const AArchVizCameraShot* Shot : Scene->GetShotsInGroup(Name(TEXT("group"))))
			{
				TSharedRef<FJsonObject> Item = MakeShared<FJsonObject>();
				Item->SetStringField(TEXT("shotId"), NameToJson(Shot->ShotId));
				Item->SetStringField(TEXT("name"), Shot->DisplayName.ToString());
				List.Add(MakeShared<FJsonValueObject>(Item));
			}
		}
		Msg->SetArrayField(TEXT("shots"), List);
		SendMessage(Msg);
	}
	else if (Cmd == TEXT("getState")) { SendStateToUI(); }
	else
	{
		OnUnhandledCommand.Broadcast(Cmd, Json);
	}
	return true;
}

void UArchVizAppSubsystem::SendStateToUI()
{
	TSharedRef<FJsonObject> Msg = MakeShared<FJsonObject>();
	Msg->SetStringField(TEXT("type"), TEXT("state"));
	Msg->SetStringField(TEXT("mode"), EnumToString(State.Mode));
	Msg->SetStringField(TEXT("building"), NameToJson(State.Building));
	Msg->SetNumberField(TEXT("floor"), State.Floor);
	Msg->SetBoolField(TEXT("section"), State.bSectionActive);
	Msg->SetStringField(TEXT("unitId"), NameToJson(State.UnitId));
	Msg->SetStringField(TEXT("poiId"), NameToJson(State.PoiId));
	Msg->SetStringField(TEXT("shotId"), NameToJson(State.ShotId));
	Msg->SetBoolField(TEXT("canGoBack"), CanGoBack());
	Msg->SetBoolField(TEXT("uiHidden"), bUIHidden);
	Msg->SetBoolField(TEXT("idle"), bIsIdle);

	if (const AArchVizEnvironment* Environment = GetEnvironment())
	{
		Msg->SetNumberField(TEXT("time"), Environment->GetTimeOfDay());
		Msg->SetStringField(TEXT("weather"), EnumToString(Environment->GetWeather()));
		Msg->SetStringField(TEXT("season"), EnumToString(Environment->GetSeason()));
		Msg->SetBoolField(TEXT("isNight"), Environment->IsNight());
	}

	if (const UArchVizSceneSubsystem* Scene = GetScene())
	{
		Msg->SetBoolField(TEXT("showAllStatuses"), Scene->GetShowAllStatuses());
	}

	if (const UArchVizInventorySubsystem* Inventory = GetInventory())
	{
		TArray<TSharedPtr<FJsonValue>> Favorites;
		for (const FName& Id : Inventory->GetFavorites())
		{
			Favorites.Add(MakeShared<FJsonValueString>(Id.ToString()));
		}
		Msg->SetArrayField(TEXT("favorites"), Favorites);
		Msg->SetBoolField(TEXT("filterActive"), Inventory->IsFilterActive());
		Msg->SetNumberField(TEXT("resultCount"), Inventory->GetActiveResults().Num());
	}

	SendMessage(Msg);
}

void UArchVizAppSubsystem::SendMessage(const TSharedRef<FJsonObject>& Message) const
{
	if (!OnOutgoingMessage.IsBound())
	{
		return;
	}
	FString Out;
	const TSharedRef<TJsonWriter<TCHAR, TCondensedJsonPrintPolicy<TCHAR>>> Writer = TJsonWriterFactory<TCHAR, TCondensedJsonPrintPolicy<TCHAR>>::Create(&Out);
	FJsonSerializer::Serialize(Message, Writer);
	OnOutgoingMessage.Broadcast(Out);
}

void UArchVizAppSubsystem::SendUnits(const TArray<FArchVizUnitRow>& Units, const FString& Type) const
{
	const UArchVizInventorySubsystem* Inventory = GetInventory();
	TSharedRef<FJsonObject> Msg = MakeShared<FJsonObject>();
	Msg->SetStringField(TEXT("type"), Type);
	TArray<TSharedPtr<FJsonValue>> List;
	for (const FArchVizUnitRow& Unit : Units)
	{
		if (TSharedPtr<FJsonObject> UnitJson = FJsonObjectConverter::UStructToJsonObject(Unit))
		{
			UnitJson->SetBoolField(TEXT("favorite"), Inventory && Inventory->IsFavorite(Unit.UnitId));
			List.Add(MakeShared<FJsonValueObject>(UnitJson));
		}
	}
	Msg->SetArrayField(TEXT("units"), List);
	Msg->SetNumberField(TEXT("count"), List.Num());
	SendMessage(Msg);
}

void UArchVizAppSubsystem::HandleResultsChanged(const TArray<FName>& UnitIds)
{
	TSharedRef<FJsonObject> Msg = MakeShared<FJsonObject>();
	Msg->SetStringField(TEXT("type"), TEXT("results"));
	TArray<TSharedPtr<FJsonValue>> Ids;
	for (const FName& Id : UnitIds)
	{
		Ids.Add(MakeShared<FJsonValueString>(Id.ToString()));
	}
	Msg->SetArrayField(TEXT("unitIds"), Ids);
	Msg->SetNumberField(TEXT("count"), Ids.Num());
	SendMessage(Msg);
}

void UArchVizAppSubsystem::HandleFavoritesChanged()
{
	SendStateToUI();
}

// --- Sales -----------------------------------------------------------------------------------

void UArchVizAppSubsystem::SubmitLead(const FArchVizLead& Lead)
{
	const UArchVizInventorySubsystem* Inventory = GetInventory();
	const UArchVizProjectAsset* Project = Inventory ? Inventory->GetProject() : nullptr;

	auto Report = [this](bool bSuccess, int32 Code)
	{
		OnLeadSubmitted.Broadcast(bSuccess, Code);
		TSharedRef<FJsonObject> Msg = MakeShared<FJsonObject>();
		Msg->SetStringField(TEXT("type"), TEXT("leadResult"));
		Msg->SetBoolField(TEXT("success"), bSuccess);
		Msg->SetNumberField(TEXT("code"), Code);
		SendMessage(Msg);
	};

	if (!Project || Project->LeadWebhookUrl.IsEmpty())
	{
		UE_LOG(LogArchViz, Warning, TEXT("SubmitLead: no Lead Webhook Url in the project asset."));
		Report(false, 0);
		return;
	}

	TSharedRef<FJsonObject> Body = MakeShared<FJsonObject>();
	Body->SetStringField(TEXT("project"), Project->ProjectName.ToString());
	Body->SetStringField(TEXT("name"), Lead.Name);
	Body->SetStringField(TEXT("phone"), Lead.Phone);
	Body->SetStringField(TEXT("email"), Lead.Email);
	Body->SetStringField(TEXT("message"), Lead.Message);
	Body->SetStringField(TEXT("unitId"), NameToJson(Lead.UnitId));
	Body->SetBoolField(TEXT("marketingConsent"), Lead.bMarketingConsent);
	Body->SetStringField(TEXT("culture"), FInternationalization::Get().GetCurrentCulture()->GetName());
	Body->SetStringField(TEXT("submittedAt"), FDateTime::UtcNow().ToIso8601());
	TArray<TSharedPtr<FJsonValue>> Favorites;
	for (const FName& Id : Inventory->GetFavorites())
	{
		Favorites.Add(MakeShared<FJsonValueString>(Id.ToString()));
	}
	Body->SetArrayField(TEXT("favorites"), Favorites);

	FString Content;
	const TSharedRef<TJsonWriter<TCHAR, TCondensedJsonPrintPolicy<TCHAR>>> Writer = TJsonWriterFactory<TCHAR, TCondensedJsonPrintPolicy<TCHAR>>::Create(&Content);
	FJsonSerializer::Serialize(Body, Writer);

	auto Request = FHttpModule::Get().CreateRequest();
	Request->SetURL(Project->LeadWebhookUrl);
	Request->SetVerb(TEXT("POST"));
	Request->SetHeader(TEXT("Content-Type"), TEXT("application/json"));
	Request->SetContentAsString(Content);

	TWeakObjectPtr<UArchVizAppSubsystem> WeakThis(this);
	Request->OnProcessRequestComplete().BindLambda([WeakThis](FHttpRequestPtr, FHttpResponsePtr Response, bool bConnected)
	{
		UArchVizAppSubsystem* Self = WeakThis.Get();
		if (!Self)
		{
			return;
		}
		const int32 Code = Response.IsValid() ? Response->GetResponseCode() : 0;
		const bool bSuccess = bConnected && EHttpResponseCodes::IsOk(Code);
		Self->OnLeadSubmitted.Broadcast(bSuccess, Code);

		TSharedRef<FJsonObject> Msg = MakeShared<FJsonObject>();
		Msg->SetStringField(TEXT("type"), TEXT("leadResult"));
		Msg->SetBoolField(TEXT("success"), bSuccess);
		Msg->SetNumberField(TEXT("code"), Code);
		Self->SendMessage(Msg);
	});
	Request->ProcessRequest();
}
