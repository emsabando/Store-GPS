#include "ArchVizFloorComponent.h"

#include "ArchVizSceneSubsystem.h"
#include "Engine/World.h"
#include "GameFramework/Actor.h"

UArchVizFloorComponent::UArchVizFloorComponent()
{
	PrimaryComponentTick.bCanEverTick = false;
}

void UArchVizFloorComponent::BeginPlay()
{
	Super::BeginPlay();
	if (UArchVizSceneSubsystem* Scene = GetWorld()->GetSubsystem<UArchVizSceneSubsystem>())
	{
		Scene->RegisterFloor(this);
	}
}

void UArchVizFloorComponent::EndPlay(const EEndPlayReason::Type EndPlayReason)
{
	if (UWorld* World = GetWorld())
	{
		if (UArchVizSceneSubsystem* Scene = World->GetSubsystem<UArchVizSceneSubsystem>())
		{
			Scene->UnregisterFloor(this);
		}
	}
	Super::EndPlay(EndPlayReason);
}

void UArchVizFloorComponent::ApplySection(bool bCutActive, FName CutBuilding, int32 CutFloor)
{
	AActor* Owner = GetOwner();
	if (!Owner)
	{
		return;
	}

	// A cut with no building named applies to every building.
	const bool bAffected = bCutActive && (CutBuilding.IsNone() || MatchesBuilding(CutBuilding));

	bool bVisible = true;
	switch (Role)
	{
	case EArchVizSectionRole::Structure:
		bVisible = !bAffected || Floor <= CutFloor;
		break;
	case EArchVizSectionRole::CutOnly:
		bVisible = bAffected && Floor == CutFloor;
		break;
	case EArchVizSectionRole::HideWhenCut:
		bVisible = !bAffected;
		break;
	}

	Owner->SetActorHiddenInGame(!bVisible);
	Owner->SetActorEnableCollision(bVisible);
}
