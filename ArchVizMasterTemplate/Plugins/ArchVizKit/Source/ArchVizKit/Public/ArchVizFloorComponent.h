#pragma once

#include "CoreMinimal.h"
#include "Components/ActorComponent.h"
#include "ArchVizFloorComponent.generated.h"

/** How a floor-tagged actor reacts to the interactive section cut. */
UENUM(BlueprintType)
enum class EArchVizSectionRole : uint8
{
	/** Slabs, walls, facade of a floor: hidden when the cut is below this floor. */
	Structure,
	/** Furniture / plan dressing: visible only while this exact floor is the cut floor. */
	CutOnly,
	/** Roof, exterior shell, crown: hidden whenever its building is cut. */
	HideWhenCut
};

/**
 * Tag an actor with its building and floor so the section cut ("Interactive section /
 * choose floor") can peel the building open. Building None matches every building.
 */
UCLASS(ClassGroup = (ArchViz), meta = (BlueprintSpawnableComponent))
class ARCHVIZKIT_API UArchVizFloorComponent : public UActorComponent
{
	GENERATED_BODY()

public:
	UArchVizFloorComponent();

	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "ArchViz")
	FName Building;

	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "ArchViz")
	int32 Floor = 0;

	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "ArchViz")
	EArchVizSectionRole Role = EArchVizSectionRole::Structure;

	/** Called by the scene subsystem whenever the cut changes. CutFloor is ignored when bCutActive is false. */
	void ApplySection(bool bCutActive, FName CutBuilding, int32 CutFloor);

	bool MatchesBuilding(FName InBuilding) const { return Building.IsNone() || Building == InBuilding; }

protected:
	virtual void BeginPlay() override;
	virtual void EndPlay(const EEndPlayReason::Type EndPlayReason) override;

private:
	/** Actor collision as authored, restored when the floor is shown again. */
	bool bOriginalActorCollision = true;
};
