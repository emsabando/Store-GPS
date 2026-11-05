#include "ArchVizCameraPawn.h"

#include "ArchVizCameraShot.h"
#include "ArchVizSceneSubsystem.h"
#include "Camera/CameraComponent.h"
#include "Engine/World.h"
#include "GameFramework/SpringArmComponent.h"

AArchVizCameraPawn::AArchVizCameraPawn()
{
	PrimaryActorTick.bCanEverTick = true;

	Pivot = CreateDefaultSubobject<USceneComponent>(TEXT("Pivot"));
	RootComponent = Pivot;

	Arm = CreateDefaultSubobject<USpringArmComponent>(TEXT("Arm"));
	Arm->SetupAttachment(Pivot);
	Arm->bDoCollisionTest = false; // archviz cameras glide through trees and glass
	Arm->bUsePawnControlRotation = false;
	Arm->bEnableCameraLag = false;
	Arm->bEnableCameraRotationLag = false;
	Arm->SetUsingAbsoluteRotation(true);
	Arm->TargetArmLength = Current.Arm;

	Camera = CreateDefaultSubobject<UCameraComponent>(TEXT("Camera"));
	Camera->SetupAttachment(Arm, USpringArmComponent::SocketName);
	Camera->SetFieldOfView(Current.FOV);

	bUseControllerRotationPitch = false;
	bUseControllerRotationYaw = false;
	bUseControllerRotationRoll = false;
}

void AArchVizCameraPawn::BeginPlay()
{
	Super::BeginPlay();

	Current.Pivot = GetActorLocation();
	Current.Yaw = static_cast<float>(GetActorRotation().Yaw);
	Current.Pitch = FMath::Clamp(-30.f, MinPitch, MaxPitch);
	Current.Arm = FMath::Clamp(Arm->TargetArmLength, MinArmLength, MaxArmLength);
	Current.FOV = Camera->FieldOfView;
	Target = Current;
	ApplyState(Current);
}

void AArchVizCameraPawn::Tick(float DeltaSeconds)
{
	Super::Tick(DeltaSeconds);

	// Deferred to the first frame so every shot in the level has registered.
	if (bPendingStartShot)
	{
		bPendingStartShot = false;
		if (!StartShotId.IsNone())
		{
			if (const UArchVizSceneSubsystem* Scene = GetWorld()->GetSubsystem<UArchVizSceneSubsystem>())
			{
				FlyToShot(Scene->FindShot(StartShotId), 0.f);
			}
		}
	}

	if (bTransitioning)
	{
		TransitionTime += DeltaSeconds;
		const float Alpha = TransitionDuration > 0.f ? FMath::Clamp(TransitionTime / TransitionDuration, 0.f, 1.f) : 1.f;
		const float Ease = FMath::InterpEaseInOut(0.f, 1.f, Alpha, 2.2f);

		Current.Pivot = FMath::Lerp(From.Pivot, To.Pivot, Ease);
		Current.Yaw = FMath::Lerp(From.Yaw, To.Yaw, Ease);
		Current.Pitch = FMath::Lerp(From.Pitch, To.Pitch, Ease);
		Current.Arm = FMath::Lerp(From.Arm, To.Arm, Ease) + TransitionArc * FMath::Sin(PI * Ease);
		Current.FOV = FMath::Lerp(From.FOV, To.FOV, Ease);

		if (Alpha >= 1.f)
		{
			bTransitioning = false;
			Current = To;
			Target = To;
			OnTransitionFinished.Broadcast();
		}
	}
	else
	{
		if (bAutoRotate)
		{
			Target.Yaw += AutoRotateSpeed * DeltaSeconds;
		}
		// Keep yaw small so float precision holds over days of kiosk turntable.
		if (FMath::Abs(Target.Yaw) > 3600.f)
		{
			const float Wrap = 360.f * FMath::RoundToFloat(Target.Yaw / 360.f);
			Target.Yaw -= Wrap;
			Current.Yaw -= Wrap;
		}
		Current.Pivot = FMath::VInterpTo(Current.Pivot, Target.Pivot, DeltaSeconds, Smoothing);
		Current.Yaw = FMath::FInterpTo(Current.Yaw, Target.Yaw, DeltaSeconds, Smoothing);
		Current.Pitch = FMath::FInterpTo(Current.Pitch, Target.Pitch, DeltaSeconds, Smoothing);
		Current.Arm = FMath::FInterpTo(Current.Arm, Target.Arm, DeltaSeconds, Smoothing);
		Current.FOV = FMath::FInterpTo(Current.FOV, Target.FOV, DeltaSeconds, Smoothing);
	}

	ApplyState(Current);
}

void AArchVizCameraPawn::ApplyState(const FOrbitState& State)
{
	SetActorLocation(State.Pivot);
	Arm->SetWorldRotation(FRotator(State.Pitch, State.Yaw, 0.f));
	Arm->TargetArmLength = State.Arm;
	Camera->SetFieldOfView(State.FOV);
}

void AArchVizCameraPawn::CancelTransition()
{
	// Any user input takes over from automation.
	bAutoRotate = false;
	if (bTransitioning)
	{
		bTransitioning = false;
		Target = Current;
	}
}

void AArchVizCameraPawn::ClampTarget()
{
	if (bLookAround)
	{
		Target.Pitch = FMath::Clamp(Target.Pitch, -80.f, 80.f);
		Target.FOV = FMath::Clamp(Target.FOV, LookAroundMinFOV, LookAroundMaxFOV);
		return;
	}

	Target.Pitch = FMath::Clamp(Target.Pitch, MinPitch, MaxPitch);
	Target.Arm = FMath::Clamp(Target.Arm, MinArmLength, MaxArmLength);
	// FBox::IsValid is not editable in the Details panel, so test the extent instead.
	if (PivotBounds.Max.X > PivotBounds.Min.X && PivotBounds.Max.Y > PivotBounds.Min.Y)
	{
		Target.Pivot = PivotBounds.GetClosestPointTo(Target.Pivot);
	}
}

void AArchVizCameraPawn::AddOrbitInput(float YawDelta, float PitchDelta)
{
	CancelTransition();
	Target.Yaw += YawDelta;
	Target.Pitch += PitchDelta;
	ClampTarget();
}

void AArchVizCameraPawn::AddZoomInput(float Steps)
{
	CancelTransition();
	if (bLookAround)
	{
		Target.FOV -= Steps * 5.f;
	}
	else
	{
		Target.Arm *= FMath::Pow(1.f - ZoomStep, Steps);
	}
	ClampTarget();
}

void AArchVizCameraPawn::AddPanInput(FVector2D ScreenDelta)
{
	if (bLookAround)
	{
		return;
	}
	CancelTransition();

	const FRotationMatrix YawMatrix(FRotator(0.f, Current.Yaw, 0.f));
	const FVector Forward = YawMatrix.GetUnitAxis(EAxis::X);
	const FVector Right = YawMatrix.GetUnitAxis(EAxis::Y);
	const float Scale = Current.Arm * 0.0015f * PanSpeed;

	// "Grab the ground": dragging right moves the scene right.
	Target.Pivot += (-Right * ScreenDelta.X + Forward * ScreenDelta.Y) * Scale;
	ClampTarget();
}

void AArchVizCameraPawn::SetAutoRotate(bool bEnable, float DegreesPerSecond)
{
	bAutoRotate = bEnable;
	AutoRotateSpeed = DegreesPerSecond;
}

void AArchVizCameraPawn::FlyTo(FVector InPivot, float Yaw, float Pitch, float ArmLength, float FieldOfView, float Duration, bool bInLookAround)
{
	// Authored destinations are not clamped: a street-level hero shot may look up,
	// a drone shot may sit beyond the user zoom limit. Limits apply to user input only.
	const bool bWasLookAround = bLookAround;
	bLookAround = bInLookAround;

	To.Pivot = InPivot;
	To.Yaw = Current.Yaw + FMath::UnwindDegrees(Yaw - Current.Yaw); // shortest way round
	To.Pitch = Pitch;
	To.Arm = bInLookAround ? 0.f : ArmLength;
	To.FOV = FieldOfView;
	Target = To;

	if (Duration <= 0.f)
	{
		bTransitioning = false;
		Current = To;
		ApplyState(Current);
		OnTransitionFinished.Broadcast();
		return;
	}

	From = Current;
	TransitionTime = 0.f;
	TransitionDuration = Duration;
	// No pull-back between interior viewpoints: it would swing the lens through walls.
	TransitionArc = (bWasLookAround && bInLookAround) ? 0.f : FlightArc * static_cast<float>(FVector::Dist(From.Pivot, To.Pivot));
	bTransitioning = true;
}

void AArchVizCameraPawn::FlyToShot(AArchVizCameraShot* Shot, float DurationOverride)
{
	if (!Shot)
	{
		return;
	}
	const FRotator Rotation = Shot->GetActorRotation();
	const float Duration = DurationOverride >= 0.f ? DurationOverride : Shot->TransitionSeconds;
	FlyTo(Shot->GetPivotLocation(), static_cast<float>(Rotation.Yaw), static_cast<float>(Rotation.Pitch), Shot->OrbitDistance, Shot->GetFieldOfView(), Duration, Shot->bLookAroundOnly);
}

void AArchVizCameraPawn::FrameBox(FBox Box, float Duration, float Padding)
{
	if (!Box.IsValid)
	{
		return;
	}
	const float Radius = static_cast<float>(Box.GetExtent().Size()) * Padding;
	const float HalfFov = FMath::DegreesToRadians(Current.FOV * 0.5f);
	const float Distance = FMath::Clamp(Radius / FMath::Max(FMath::Sin(HalfFov), 0.05f), MinArmLength, MaxArmLength);
	const float Pitch = bLookAround ? -20.f : FMath::Clamp(Current.Pitch, MinPitch, MaxPitch);
	FlyTo(Box.GetCenter(), Current.Yaw, Pitch, Distance, Current.FOV, Duration, false);
}

void AArchVizCameraPawn::GetOrbit(FVector& OutPivot, float& OutYaw, float& OutPitch, float& OutArmLength, float& OutFieldOfView, bool& bOutLookAround) const
{
	OutPivot = Target.Pivot;
	OutYaw = Target.Yaw;
	OutPitch = Target.Pitch;
	OutArmLength = Target.Arm;
	OutFieldOfView = Target.FOV;
	bOutLookAround = bLookAround;
}
