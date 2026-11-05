#pragma once

#include "CoreMinimal.h"
#include "GameFramework/PlayerController.h"
#include "ArchVizPlayerController.generated.h"

class AArchVizCameraPawn;

/**
 * Mouse + touch control for AArchVizCameraPawn that works with zero input assets:
 *   LMB drag / 1 finger  = orbit      RMB, MMB or Shift+LMB drag / 2 fingers = pan
 *   wheel / pinch        = zoom       click / tap (no drag) = select unit or POI
 * Presses that land on UMG never reach here, so panels and buttons keep working.
 * Replace or extend in Blueprint if you prefer Enhanced Input.
 */
UCLASS()
class ARCHVIZKIT_API AArchVizPlayerController : public APlayerController
{
	GENERATED_BODY()

public:
	AArchVizPlayerController();

	virtual void BeginPlay() override;
	virtual void PlayerTick(float DeltaTime) override;

	/** Pause camera input, e.g. while a full-screen gallery or form is open. */
	UFUNCTION(BlueprintCallable, Category = "ArchViz|Input")
	void SetCameraInputEnabled(bool bEnabled) { bCameraInputEnabled = bEnabled; }

	/** Degrees per pixel of drag. */
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "ArchViz|Input")
	float MouseOrbitSpeed = 0.25f;

	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "ArchViz|Input")
	float TouchOrbitSpeed = 0.2f;

	/** Pixels of pinch change per zoom step. */
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "ArchViz|Input")
	float PinchPixelsPerStep = 40.f;

	/** Movement (px) before a press counts as a drag instead of a click. */
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "ArchViz|Input")
	float DragThreshold = 6.f;

	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "ArchViz|Input")
	bool bInvertPitch = false;

protected:
	/** Click / tap that did not become a drag. Default: select unit or POI under the point. */
	UFUNCTION(BlueprintNativeEvent, Category = "ArchViz|Input")
	void HandleClick(FVector2D ScreenPosition);
	virtual void HandleClick_Implementation(FVector2D ScreenPosition);

private:
	void TickMouse(AArchVizCameraPawn* Camera);
	void TickTouch(AArchVizCameraPawn* Camera);
	void NotifyActivity() const;

	bool bCameraInputEnabled = true;

	bool bMouseDragging = false;
	FVector2D MousePressPos = FVector2D::ZeroVector;
	FVector2D LastMousePos = FVector2D::ZeroVector;

	bool bTouchWasDown[2] = { false, false };
	FVector2D LastTouchPos[2];
	FVector2D TouchPressPos = FVector2D::ZeroVector;
	bool bTouchDragging = false;
	float LastPinchDistance = 0.f;
};
