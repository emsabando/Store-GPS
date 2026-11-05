#include "ArchVizUnitComponent.h"

#include "ArchVizSceneSubsystem.h"
#include "Components/MeshComponent.h"
#include "Components/PrimitiveComponent.h"
#include "Engine/World.h"
#include "GameFramework/Actor.h"
#include "Materials/MaterialInstanceDynamic.h"

namespace
{
	UArchVizSceneSubsystem* GetScene(const UActorComponent* Component)
	{
		const UWorld* World = Component ? Component->GetWorld() : nullptr;
		return World ? World->GetSubsystem<UArchVizSceneSubsystem>() : nullptr;
	}
}

UArchVizUnitComponent::UArchVizUnitComponent()
{
	PrimaryComponentTick.bCanEverTick = false;
}

void UArchVizUnitComponent::BeginPlay()
{
	Super::BeginPlay();

	GatherPrimitives();

	if (OverlayMaterial)
	{
		OverlayMID = UMaterialInstanceDynamic::Create(OverlayMaterial, this);
	}

	for (UPrimitiveComponent* Prim : Primitives)
	{
		if (bConfigureCollision)
		{
			Prim->SetCollisionEnabled(ECollisionEnabled::QueryOnly);
			Prim->SetCollisionResponseToAllChannels(ECR_Ignore);
			Prim->SetCollisionResponseToChannel(ECC_Visibility, ECR_Block);
		}
		OriginalCollision.Add(Prim->GetCollisionEnabled());

		Prim->OnClicked.AddDynamic(this, &UArchVizUnitComponent::HandleClicked);
		Prim->OnInputTouchBegin.AddDynamic(this, &UArchVizUnitComponent::HandleTouch);
		Prim->OnBeginCursorOver.AddDynamic(this, &UArchVizUnitComponent::HandleCursorOver);
		Prim->OnEndCursorOver.AddDynamic(this, &UArchVizUnitComponent::HandleCursorOut);
	}

	UpdateVisibility();

	if (UArchVizSceneSubsystem* Scene = GetScene(this))
	{
		Scene->RegisterUnit(this);
	}
}

void UArchVizUnitComponent::EndPlay(const EEndPlayReason::Type EndPlayReason)
{
	if (UArchVizSceneSubsystem* Scene = GetScene(this))
	{
		Scene->UnregisterUnit(this);
	}
	Super::EndPlay(EndPlayReason);
}

void UArchVizUnitComponent::GatherPrimitives()
{
	Primitives.Reset();
	OriginalCollision.Reset();

	const AActor* Owner = GetOwner();
	if (!Owner)
	{
		return;
	}

	TInlineComponentArray<UPrimitiveComponent*> Found(Owner);
	for (UPrimitiveComponent* Prim : Found)
	{
		if (Prim && (PrimitiveTag.IsNone() || Prim->ComponentHasTag(PrimitiveTag)))
		{
			Primitives.Add(Prim);
		}
	}
}

void UArchVizUnitComponent::ApplyHighlight(bool bHighlighted, int32 Stencil, FLinearColor Color, bool bSelected)
{
	bIsHighlighted = bHighlighted;
	const bool bUseCustomDepth = bHighlighted && Stencil >= 0;

	if (OverlayMID)
	{
		OverlayMID->SetVectorParameterValue(TEXT("Color"), Color);
		OverlayMID->SetScalarParameterValue(TEXT("Selected"), bSelected ? 1.f : 0.f);
	}

	for (UPrimitiveComponent* Prim : Primitives)
	{
		if (!Prim)
		{
			continue;
		}

		Prim->SetRenderCustomDepth(bUseCustomDepth);
		if (bUseCustomDepth)
		{
			Prim->SetCustomDepthStencilValue(FMath::Clamp(Stencil, 0, 255));
		}

		if (OverlayMID)
		{
			if (UMeshComponent* Mesh = Cast<UMeshComponent>(Prim))
			{
				Mesh->SetOverlayMaterial(bHighlighted ? OverlayMID.Get() : nullptr);
			}
		}
	}

	UpdateVisibility();
	OnHighlightChanged(bHighlighted, Color, bSelected);
}

void UArchVizUnitComponent::SetSectionHidden(bool bHidden)
{
	if (bSectionHidden == bHidden)
	{
		return;
	}
	bSectionHidden = bHidden;

	// Units above the cut must not swallow clicks meant for the floor below.
	for (int32 i = 0; i < Primitives.Num(); ++i)
	{
		if (Primitives[i])
		{
			Primitives[i]->SetCollisionEnabled(bHidden ? ECollisionEnabled::NoCollision : OriginalCollision[i]);
		}
	}
	UpdateVisibility();
}

void UArchVizUnitComponent::UpdateVisibility()
{
	const bool bVisible = !bSectionHidden && (bIsHighlighted || !bHideWhenIdle);
	for (UPrimitiveComponent* Prim : Primitives)
	{
		if (Prim)
		{
			// Hidden-in-game primitives still receive cursor traces, so idle volumes stay hoverable.
			Prim->SetHiddenInGame(!bVisible);
		}
	}
}

FBox UArchVizUnitComponent::GetUnitBounds() const
{
	FBox Box(ForceInit);
	for (const UPrimitiveComponent* Prim : Primitives)
	{
		if (Prim)
		{
			Box += Prim->Bounds.GetBox();
		}
	}
	return Box;
}

void UArchVizUnitComponent::HandleClicked(UPrimitiveComponent* /*TouchedComponent*/, FKey /*ButtonPressed*/)
{
	if (UArchVizSceneSubsystem* Scene = GetScene(this))
	{
		Scene->NotifyUnitClicked(UnitId);
	}
}

void UArchVizUnitComponent::HandleTouch(ETouchIndex::Type /*FingerIndex*/, UPrimitiveComponent* /*TouchedComponent*/)
{
	if (UArchVizSceneSubsystem* Scene = GetScene(this))
	{
		Scene->NotifyUnitClicked(UnitId);
	}
}

void UArchVizUnitComponent::HandleCursorOver(UPrimitiveComponent* /*TouchedComponent*/)
{
	if (UArchVizSceneSubsystem* Scene = GetScene(this))
	{
		Scene->NotifyUnitHovered(UnitId, true);
	}
}

void UArchVizUnitComponent::HandleCursorOut(UPrimitiveComponent* /*TouchedComponent*/)
{
	if (UArchVizSceneSubsystem* Scene = GetScene(this))
	{
		Scene->NotifyUnitHovered(UnitId, false);
	}
}
