#pragma once

#include "CoreMinimal.h"
#include "GameFramework/Pawn.h"
#include "ArchVizCameraPawn.generated.h"

class USpringArmComponent;
class UCameraComponent;
class AArchVizCameraShot;

DECLARE_DYNAMIC_MULTICAST_DELEGATE(FArchVizCameraEvent);

/**
 * Orbit / pan / zoom camera for masterplan and building views, with eased fly-to transitions
 * between shots and a look-around mode for interiors. Input-system agnostic: call the Add*Input
 * functions from Enhanced Input, UMG or the bundled AArchVizPlayerController (mouse + touch).
 */
UCLASS()
class ARCHVIZKIT_API AArchVizCameraPawn : public APawn
{
	GENERATED_BODY()

public:
	AArchVizCameraPawn();

	virtual void Tick(float DeltaSeconds) override;

	// --- Input ---------------------------------------------------------------
	/** Degrees. Cancels a running transition. */
	UFUNCTION(BlueprintCallable, Category = "ArchViz|Camera")
	void AddOrbitInput(float YawDelta, float PitchDelta);

	/** Positive zooms in. One mouse-wheel notch = 1. In look-around mode this narrows the FOV. */
	UFUNCTION(BlueprintCallable, Category = "ArchViz|Camera")
	void AddZoomInput(float Steps);

	/** Screen-space drag in pixels; moves the pivot on the ground plane, scaled by distance. */
	UFUNCTION(BlueprintCallable, Category = "ArchViz|Camera")
	void AddPanInput(FVector2D ScreenDelta);

	/** Slow turntable for attract loops and idle presentation. */
	UFUNCTION(BlueprintCallable, Category = "ArchViz|Camera")
	void SetAutoRotate(bool bEnable, float DegreesPerSecond = 4.f);

	// --- Movement ------------------------------------------------------------
	/** Fly to an orbit state. Pitch is negative when looking down. Duration 0 snaps. */
	UFUNCTION(BlueprintCallable, Category = "ArchViz|Camera")
	void FlyTo(FVector InPivot, float Yaw, float Pitch, float ArmLength, float FieldOfView, float Duration, bool bInLookAround = false);

	/** DurationOverride < 0 uses the shot's own TransitionSeconds. */
	UFUNCTION(BlueprintCallable, Category = "ArchViz|Camera")
	void FlyToShot(AArchVizCameraShot* Shot, float DurationOverride = -1.f);

	/** Keep the current angle, move and zoom so the box fills the view (fly to a unit). */
	UFUNCTION(BlueprintCallable, Category = "ArchViz|Camera")
	void FrameBox(FBox Box, float Duration = 1.5f, float Padding = 1.4f);

	UFUNCTION(BlueprintPure, Category = "ArchViz|Camera")
	bool IsTransitioning() const { return bTransitioning; }

	/** Where the camera is heading (or resting): used to restore views on Back. */
	UFUNCTION(BlueprintPure, Category = "ArchViz|Camera")
	void GetOrbit(FVector& OutPivot, float& OutYaw, float& OutPitch, float& OutArmLength, float& OutFieldOfView, bool& bOutLookAround) const;

	UFUNCTION(BlueprintPure, Category = "ArchViz|Camera")
	bool IsLookAround() const { return bLookAround; }

	UFUNCTION(BlueprintPure, Category = "ArchViz|Camera")
	UCameraComponent* GetCamera() const { return Camera; }

	UPROPERTY(BlueprintAssignable, Category = "ArchViz|Camera")
	FArchVizCameraEvent OnTransitionFinished;

	// --- Tuning --------------------------------------------------------------
	/** Shot to snap to on the first frame. */
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "ArchViz|Camera")
	FName StartShotId;

	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "ArchViz|Camera|Limits")
	float MinPitch = -85.f;

	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "ArchViz|Camera|Limits")
	float MaxPitch = -5.f;

	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "ArchViz|Camera|Limits")
	float MinArmLength = 800.f;

	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "ArchViz|Camera|Limits")
	float MaxArmLength = 60000.f;

	/** Keep the pivot inside the site. Ignored until Max is greater than Min in X and Y (the default is off). */
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "ArchViz|Camera|Limits")
	FBox PivotBounds = FBox(ForceInit);

	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "ArchViz|Camera|Limits")
	float LookAroundMinFOV = 35.f;

	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "ArchViz|Camera|Limits")
	float LookAroundMaxFOV = 95.f;

	/** Fraction of the distance removed per zoom step. */
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "ArchViz|Camera|Feel", meta = (ClampMin = 0.01, ClampMax = 0.5))
	float ZoomStep = 0.12f;

	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "ArchViz|Camera|Feel")
	float PanSpeed = 1.f;

	/** Higher = snappier. Applied to orbit / pan / zoom (not to fly-to transitions). */
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "ArchViz|Camera|Feel")
	float Smoothing = 8.f;

	/** How much a long flight pulls back mid-way, as a fraction of the travelled distance. */
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "ArchViz|Camera|Feel", meta = (ClampMin = 0, ClampMax = 1))
	float FlightArc = 0.25f;

protected:
	virtual void BeginPlay() override;

	UPROPERTY(VisibleAnywhere, BlueprintReadOnly, Category = "ArchViz|Camera")
	TObjectPtr<USceneComponent> Pivot;

	UPROPERTY(VisibleAnywhere, BlueprintReadOnly, Category = "ArchViz|Camera")
	TObjectPtr<USpringArmComponent> Arm;

	UPROPERTY(VisibleAnywhere, BlueprintReadOnly, Category = "ArchViz|Camera")
	TObjectPtr<UCameraComponent> Camera;

private:
	struct FOrbitState
	{
		FVector Pivot = FVector::ZeroVector;
		float Yaw = 0.f;
		float Pitch = -30.f;
		float Arm = 5000.f;
		float FOV = 60.f;
	};

	void CancelTransition();
	void ClampTarget();
	void ApplyState(const FOrbitState& State);

	FOrbitState Current;
	FOrbitState Target;

	bool bTransitioning = false;
	float TransitionTime = 0.f;
	float TransitionDuration = 0.f;
	float TransitionArc = 0.f;
	FOrbitState From;
	FOrbitState To;

	bool bLookAround = false;
	bool bAutoRotate = false;
	float AutoRotateSpeed = 4.f;
	bool bPendingStartShot = true;
};
