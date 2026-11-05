#include "ArchVizSceneSubsystem.h"

#include "Algo/Sort.h"
#include "ArchVizAppSubsystem.h"
#include "ArchVizCameraShot.h"
#include "ArchVizFloorComponent.h"
#include "ArchVizInventorySubsystem.h"
#include "ArchVizKit.h"
#include "ArchVizPOI.h"
#include "ArchVizProjectAsset.h"
#include "ArchVizSettings.h"
#include "ArchVizUnitComponent.h"
#include "Engine/GameInstance.h"
#include "Engine/World.h"

namespace
{
	template <typename T>
	T* GetGameInstanceSubsystem(const UWorld* World)
	{
		const UGameInstance* GameInstance = World ? World->GetGameInstance() : nullptr;
		return GameInstance ? GameInstance->GetSubsystem<T>() : nullptr;
	}
}

bool UArchVizSceneSubsystem::DoesSupportWorldType(const EWorldType::Type WorldType) const
{
	return WorldType == EWorldType::Game || WorldType == EWorldType::PIE;
}

UArchVizInventorySubsystem* UArchVizSceneSubsystem::GetInventory() const
{
	return GetGameInstanceSubsystem<UArchVizInventorySubsystem>(GetWorld());
}

void UArchVizSceneSubsystem::OnWorldBeginPlay(UWorld& InWorld)
{
	Super::OnWorldBeginPlay(InWorld);

	if (UArchVizInventorySubsystem* Inventory = GetInventory())
	{
		Inventory->OnResultsChanged.AddDynamic(this, &UArchVizSceneSubsystem::HandleResultsChanged);
		Inventory->OnInventoryChanged.AddDynamic(this, &UArchVizSceneSubsystem::HandleInventoryChanged);

		// A search started in another level (e.g. before travelling) carries over.
		ResultSet.Reset();
		ResultSet.Append(Inventory->GetActiveResults());
	}
	RefreshUnitVisuals();
}

void UArchVizSceneSubsystem::Deinitialize()
{
	if (UArchVizInventorySubsystem* Inventory = GetInventory())
	{
		Inventory->OnResultsChanged.RemoveDynamic(this, &UArchVizSceneSubsystem::HandleResultsChanged);
		Inventory->OnInventoryChanged.RemoveDynamic(this, &UArchVizSceneSubsystem::HandleInventoryChanged);
	}
	Super::Deinitialize();
}

// --- Registration ---------------------------------------------------------

void UArchVizSceneSubsystem::RegisterUnit(UArchVizUnitComponent* Unit)
{
	if (!Unit)
	{
		return;
	}
	if (Unit->UnitId.IsNone())
	{
		UE_LOG(LogArchViz, Warning, TEXT("%s has an ArchVizUnitComponent with no UnitId."), *GetNameSafe(Unit->GetOwner()));
	}
	Units.AddUnique(Unit);
	RefreshUnit(Unit);
}

void UArchVizSceneSubsystem::UnregisterUnit(UArchVizUnitComponent* Unit)
{
	Units.Remove(Unit);
}

void UArchVizSceneSubsystem::RegisterFloor(UArchVizFloorComponent* Floor)
{
	if (!Floor)
	{
		return;
	}
	Floors.AddUnique(Floor);
	Floor->ApplySection(bSectionActive, SectionBuilding, SectionFloor);
}

void UArchVizSceneSubsystem::UnregisterFloor(UArchVizFloorComponent* Floor)
{
	Floors.Remove(Floor);
}

void UArchVizSceneSubsystem::RegisterShot(AArchVizCameraShot* Shot)
{
	if (!Shot || Shot->ShotId.IsNone())
	{
		UE_LOG(LogArchViz, Warning, TEXT("Camera shot %s has no ShotId and cannot be referenced."), *GetNameSafe(Shot));
		return;
	}
	if (const TWeakObjectPtr<AArchVizCameraShot>* Existing = Shots.Find(Shot->ShotId))
	{
		if (Existing->IsValid() && Existing->Get() != Shot)
		{
			UE_LOG(LogArchViz, Warning, TEXT("Duplicate ShotId %s (%s and %s)."), *Shot->ShotId.ToString(), *GetNameSafe(Existing->Get()), *GetNameSafe(Shot));
		}
	}
	Shots.Add(Shot->ShotId, Shot);
}

void UArchVizSceneSubsystem::UnregisterShot(AArchVizCameraShot* Shot)
{
	if (Shot && Shots.FindRef(Shot->ShotId).Get() == Shot)
	{
		Shots.Remove(Shot->ShotId);
	}
}

void UArchVizSceneSubsystem::RegisterPOI(AArchVizPOI* POI)
{
	if (!POI)
	{
		return;
	}
	POIs.AddUnique(POI);
	POI->SetLabelVisible(bPOIsVisible);
}

void UArchVizSceneSubsystem::UnregisterPOI(AArchVizPOI* POI)
{
	POIs.Remove(POI);
}

// --- Scene input ------------------------------------------------------------

void UArchVizSceneSubsystem::NotifyUnitClicked(FName UnitId)
{
	if (UnitId.IsNone())
	{
		return;
	}
	OnUnitClicked.Broadcast(UnitId);
	if (UArchVizAppSubsystem* App = GetGameInstanceSubsystem<UArchVizAppSubsystem>(GetWorld()))
	{
		App->HandleUnitClicked(UnitId);
	}
}

void UArchVizSceneSubsystem::NotifyUnitHovered(FName UnitId, bool bHovered)
{
	if (bHovered)
	{
		if (HoveredUnit == UnitId)
		{
			return;
		}
		const FName Previous = HoveredUnit;
		HoveredUnit = UnitId;
		RefreshUnitsWithId(Previous);
		RefreshUnitsWithId(UnitId);
		OnUnitHovered.Broadcast(UnitId);
	}
	else if (HoveredUnit == UnitId)
	{
		HoveredUnit = NAME_None;
		RefreshUnitsWithId(UnitId);
		OnUnitHovered.Broadcast(NAME_None);
	}
}

void UArchVizSceneSubsystem::SetHoveredUnit(FName UnitId)
{
	if (UnitId.IsNone())
	{
		NotifyUnitHovered(HoveredUnit, false);
	}
	else
	{
		NotifyUnitHovered(UnitId, true);
	}
}

void UArchVizSceneSubsystem::NotifyPOIClicked(AArchVizPOI* POI)
{
	if (!POI)
	{
		return;
	}
	OnPOIClicked.Broadcast(POI);
	if (UArchVizAppSubsystem* App = GetGameInstanceSubsystem<UArchVizAppSubsystem>(GetWorld()))
	{
		App->HandlePOIClicked(POI);
	}
}

// --- Lookups ------------------------------------------------------------------

AArchVizCameraShot* UArchVizSceneSubsystem::FindShot(FName ShotId) const
{
	const TWeakObjectPtr<AArchVizCameraShot>* Found = Shots.Find(ShotId);
	return Found ? Found->Get() : nullptr;
}

TArray<AArchVizCameraShot*> UArchVizSceneSubsystem::GetShotsInGroup(FName Group) const
{
	TArray<AArchVizCameraShot*> Result;
	for (const TPair<FName, TWeakObjectPtr<AArchVizCameraShot>>& Pair : Shots)
	{
		AArchVizCameraShot* Shot = Pair.Value.Get();
		if (Shot && Shot->Group == Group)
		{
			Result.Add(Shot);
		}
	}
	Algo::SortBy(Result, [](const AArchVizCameraShot* Shot) { return Shot->Order; });
	return Result;
}

AArchVizPOI* UArchVizSceneSubsystem::FindPOI(FName PoiId) const
{
	for (const TWeakObjectPtr<AArchVizPOI>& Weak : POIs)
	{
		AArchVizPOI* POI = Weak.Get();
		if (POI && POI->PoiId == PoiId)
		{
			return POI;
		}
	}
	return nullptr;
}

TArray<AArchVizPOI*> UArchVizSceneSubsystem::GetPOIs(FName Category) const
{
	TArray<AArchVizPOI*> Result;
	for (const TWeakObjectPtr<AArchVizPOI>& Weak : POIs)
	{
		AArchVizPOI* POI = Weak.Get();
		if (POI && (Category.IsNone() || POI->Category == Category))
		{
			Result.Add(POI);
		}
	}
	Algo::SortBy(Result, [](const AArchVizPOI* POI) { return POI->Order; });
	return Result;
}

bool UArchVizSceneSubsystem::GetUnitBounds(FName UnitId, FBox& OutBounds) const
{
	OutBounds = FBox(ForceInit);
	for (const TWeakObjectPtr<UArchVizUnitComponent>& Weak : Units)
	{
		const UArchVizUnitComponent* Unit = Weak.Get();
		if (Unit && Unit->UnitId == UnitId)
		{
			OutBounds += Unit->GetUnitBounds();
		}
	}
	return OutBounds.IsValid != 0;
}

TArray<int32> UArchVizSceneSubsystem::GetFloors(FName Building) const
{
	TArray<int32> Result;
	for (const TWeakObjectPtr<UArchVizFloorComponent>& Weak : Floors)
	{
		const UArchVizFloorComponent* Floor = Weak.Get();
		if (Floor && Floor->Role == EArchVizSectionRole::Structure && Floor->MatchesBuilding(Building))
		{
			Result.AddUnique(Floor->Floor);
		}
	}
	Result.Sort();
	return Result;
}

// --- Section cut ----------------------------------------------------------------

void UArchVizSceneSubsystem::SetSection(FName Building, int32 Floor)
{
	bSectionActive = true;
	SectionBuilding = Building;
	SectionFloor = Floor;
	ApplySectionToFloors();
	RefreshUnitVisuals();
	OnSectionChanged.Broadcast(true, Building, Floor);
}

void UArchVizSceneSubsystem::ClearSection()
{
	if (!bSectionActive)
	{
		return;
	}
	bSectionActive = false;
	SectionBuilding = NAME_None;
	SectionFloor = 0;
	ApplySectionToFloors();
	RefreshUnitVisuals();
	OnSectionChanged.Broadcast(false, NAME_None, 0);
}

bool UArchVizSceneSubsystem::GetSection(FName& OutBuilding, int32& OutFloor) const
{
	OutBuilding = SectionBuilding;
	OutFloor = SectionFloor;
	return bSectionActive;
}

void UArchVizSceneSubsystem::ApplySectionToFloors() const
{
	for (const TWeakObjectPtr<UArchVizFloorComponent>& Weak : Floors)
	{
		if (UArchVizFloorComponent* Floor = Weak.Get())
		{
			Floor->ApplySection(bSectionActive, SectionBuilding, SectionFloor);
		}
	}
}

// --- Highlight --------------------------------------------------------------------

void UArchVizSceneSubsystem::SetSelectedUnit(FName UnitId)
{
	if (SelectedUnit == UnitId)
	{
		return;
	}
	const FName Previous = SelectedUnit;
	SelectedUnit = UnitId;
	RefreshUnitsWithId(Previous);
	RefreshUnitsWithId(UnitId);
}

void UArchVizSceneSubsystem::SetShowAllStatuses(bool bShow)
{
	if (bShowAllStatuses != bShow)
	{
		bShowAllStatuses = bShow;
		RefreshUnitVisuals();
	}
}

void UArchVizSceneSubsystem::SetPOIsVisible(bool bVisible)
{
	bPOIsVisible = bVisible;
	for (const TWeakObjectPtr<AArchVizPOI>& Weak : POIs)
	{
		if (AArchVizPOI* POI = Weak.Get())
		{
			POI->SetLabelVisible(bVisible);
		}
	}
}

void UArchVizSceneSubsystem::RefreshUnitVisuals()
{
	for (const TWeakObjectPtr<UArchVizUnitComponent>& Weak : Units)
	{
		if (UArchVizUnitComponent* Unit = Weak.Get())
		{
			RefreshUnit(Unit);
		}
	}
}

void UArchVizSceneSubsystem::RefreshUnitsWithId(FName UnitId) const
{
	if (UnitId.IsNone())
	{
		return;
	}
	for (const TWeakObjectPtr<UArchVizUnitComponent>& Weak : Units)
	{
		UArchVizUnitComponent* Unit = Weak.Get();
		if (Unit && Unit->UnitId == UnitId)
		{
			RefreshUnit(Unit);
		}
	}
}

void UArchVizSceneSubsystem::RefreshUnit(UArchVizUnitComponent* Unit) const
{
	if (!Unit)
	{
		return;
	}

	const UArchVizInventorySubsystem* Inventory = GetInventory();
	const UArchVizSettings* Settings = UArchVizSettings::Get();

	FArchVizUnitRow Row;
	const bool bKnown = Inventory && Inventory->GetUnit(Unit->UnitId, Row);

	const bool bCutHere = bSectionActive && bKnown && (SectionBuilding.IsNone() || Row.Building == SectionBuilding);
	Unit->SetSectionHidden(bCutHere && Row.Floor > SectionFloor);

	const bool bSelected = !SelectedUnit.IsNone() && Unit->UnitId == SelectedUnit;
	const bool bHovered = !HoveredUnit.IsNone() && Unit->UnitId == HoveredUnit;
	const bool bInResults = ResultSet.Contains(Unit->UnitId);
	const bool bHighlighted = bSelected || bHovered || bInResults || (bShowAllStatuses && bKnown);

	int32 Stencil = -1;
	FLinearColor Color = FLinearColor::White;
	if (bKnown)
	{
		const UArchVizProjectAsset* Project = Inventory->GetProject();
		Color = Project ? Project->Theme.GetStatusColor(Row.Status) : FLinearColor::White;
		switch (Row.Status)
		{
		case EArchVizUnitStatus::Available: Stencil = Settings->StencilAvailable; break;
		case EArchVizUnitStatus::Reserved:  Stencil = Settings->StencilReserved;  break;
		default:                            Stencil = Settings->StencilSold;      break;
		}
	}
	if (bSelected)
	{
		Stencil = Settings->StencilSelected;
	}

	Unit->ApplyHighlight(bHighlighted, Stencil, Color, bSelected);
}

void UArchVizSceneSubsystem::HandleResultsChanged(const TArray<FName>& UnitIds)
{
	ResultSet.Reset();
	ResultSet.Append(UnitIds);
	RefreshUnitVisuals();
}

void UArchVizSceneSubsystem::HandleInventoryChanged()
{
	// Statuses or prices may have changed (CRM sync): recolour.
	RefreshUnitVisuals();
}
