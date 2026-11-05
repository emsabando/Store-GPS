#pragma once

#include "CoreMinimal.h"
#include "Components/ActorComponent.h"
#include "Engine/EngineTypes.h"
#include "InputCoreTypes.h"
#include "ArchVizUnitComponent.generated.h"

class UMaterialInterface;
class UMaterialInstanceDynamic;
class UPrimitiveComponent;

/**
 * Marks an actor as the clickable / highlightable shape of one apartment.
 * Typical setup: one simple "highlight volume" mesh per unit hugging its facade,
 * hidden until hovered, filtered or selected (bHideWhenIdle). The scene subsystem
 * decides the state; this component only renders it.
 */
UCLASS(ClassGroup = (ArchViz), meta = (BlueprintSpawnableComponent))
class ARCHVIZKIT_API UArchVizUnitComponent : public UActorComponent
{
	GENERATED_BODY()

public:
	UArchVizUnitComponent();

	/** Must match a UnitId in the units table. */
	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "ArchViz")
	FName UnitId;

	/** Hide the meshes unless highlighted. Turn off when the component sits on real facade geometry. */
	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "ArchViz")
	bool bHideWhenIdle = true;

	/** Set the meshes to query-only collision that blocks only the Visibility channel (clicks), so they never block the camera. */
	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "ArchViz")
	bool bConfigureCollision = true;

	/** Only primitives carrying this component tag are driven. None = every primitive on the actor. */
	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "ArchViz")
	FName PrimitiveTag;

	/**
	 * Optional overlay material (UE 5.1+ mesh overlay). Gets a vector parameter "Color"
	 * and a scalar "Selected" (0/1). Leave empty to rely on the custom-depth outline only.
	 */
	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "ArchViz")
	TObjectPtr<UMaterialInterface> OverlayMaterial;

	/** Called by the scene subsystem. Stencil < 0 disables custom depth. */
	UFUNCTION(BlueprintCallable, Category = "ArchViz")
	void ApplyHighlight(bool bHighlighted, int32 Stencil, FLinearColor Color, bool bSelected);

	/** Hidden by a section cut (floor above the cut). Overrides highlight. */
	UFUNCTION(BlueprintCallable, Category = "ArchViz")
	void SetSectionHidden(bool bHidden);

	UFUNCTION(BlueprintPure, Category = "ArchViz")
	bool IsHighlighted() const { return bIsHighlighted; }

	/** World bounds of the driven primitives, for framing the camera on the unit. */
	UFUNCTION(BlueprintPure, Category = "ArchViz")
	FBox GetUnitBounds() const;

	/** Hook for Blueprint polish: pulse, floating price tag, sound... */
	UFUNCTION(BlueprintImplementableEvent, Category = "ArchViz")
	void OnHighlightChanged(bool bHighlighted, FLinearColor Color, bool bSelected);

protected:
	virtual void BeginPlay() override;
	virtual void EndPlay(const EEndPlayReason::Type EndPlayReason) override;

private:
	void GatherPrimitives();
	void UpdateVisibility();

	UFUNCTION()
	void HandleClicked(UPrimitiveComponent* TouchedComponent, FKey ButtonPressed);

	UFUNCTION()
	void HandleTouch(ETouchIndex::Type FingerIndex, UPrimitiveComponent* TouchedComponent);

	UFUNCTION()
	void HandleCursorOver(UPrimitiveComponent* TouchedComponent);

	UFUNCTION()
	void HandleCursorOut(UPrimitiveComponent* TouchedComponent);

	UPROPERTY(Transient)
	TArray<TObjectPtr<UPrimitiveComponent>> Primitives;

	UPROPERTY(Transient)
	TObjectPtr<UMaterialInstanceDynamic> OverlayMID;

	/** Collision state after BeginPlay setup, restored when a section cut un-hides the unit. */
	TArray<ECollisionEnabled::Type> OriginalCollision;

	bool bIsHighlighted = false;
	bool bSectionHidden = false;
};
