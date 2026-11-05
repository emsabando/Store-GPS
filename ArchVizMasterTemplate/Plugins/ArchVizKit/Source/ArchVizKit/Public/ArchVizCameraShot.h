#pragma once

#include "CoreMinimal.h"
#include "GameFramework/Actor.h"
#include "ArchVizCameraShot.generated.h"

class UCameraComponent;

/**
 * A named camera position. Place it like a camera (pilot it in the editor), give it a ShotId,
 * then reference it from floor-plan viewpoints, POIs, tours and web/UMG commands.
 * After arriving, the user orbits around a pivot OrbitDistance in front of the lens,
 * or only looks around in place (interiors, balcony views).
 */
UCLASS(ClassGroup = (ArchViz), hidecategories = (Rendering, Replication, Collision, Input, HLOD, Physics, Networking))
class ARCHVIZKIT_API AArchVizCameraShot : public AActor
{
	GENERATED_BODY()

public:
	AArchVizCameraShot();

	/** Unique per level. */
	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "ArchViz")
	FName ShotId;

	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "ArchViz")
	FText DisplayName;

	/** Shots sharing a group form a tour (attract loop, building presentation). */
	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "ArchViz")
	FName Group;

	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "ArchViz")
	int32 Order = 0;

	/** Distance (cm) from the lens to the orbit pivot. */
	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "ArchViz", meta = (ClampMin = 10, EditCondition = "!bLookAroundOnly"))
	float OrbitDistance = 3000.f;

	/** Rotate in place instead of orbiting (interior viewpoints, balcony views, 360 spots). */
	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "ArchViz")
	bool bLookAroundOnly = false;

	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "ArchViz", meta = (ClampMin = 0))
	float TransitionSeconds = 2.f;

	UFUNCTION(BlueprintPure, Category = "ArchViz")
	FVector GetPivotLocation() const;

	UFUNCTION(BlueprintPure, Category = "ArchViz")
	float GetFieldOfView() const;

	UFUNCTION(BlueprintPure, Category = "ArchViz")
	UCameraComponent* GetCamera() const { return Camera; }

protected:
	virtual void BeginPlay() override;
	virtual void EndPlay(const EEndPlayReason::Type EndPlayReason) override;

	UPROPERTY(VisibleAnywhere, BlueprintReadOnly, Category = "ArchViz")
	TObjectPtr<UCameraComponent> Camera;
};
