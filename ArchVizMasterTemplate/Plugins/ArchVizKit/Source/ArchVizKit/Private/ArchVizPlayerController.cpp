#include "ArchVizPlayerController.h"

#include "ArchVizAppSubsystem.h"
#include "ArchVizCameraPawn.h"
#include "ArchVizPOI.h"
#include "ArchVizSceneSubsystem.h"
#include "ArchVizUnitComponent.h"
#include "Engine/GameInstance.h"
#include "Engine/World.h"

AArchVizPlayerController::AArchVizPlayerController()
{
	bShowMouseCursor = true;
	bEnableClickEvents = false;     // clicks are resolved in HandleClick (drag-aware)
	bEnableMouseOverEvents = true;  // drives unit hover highlight
	bEnableTouchEvents = false;
	bEnableTouchOverEvents = false;
	LastTouchPos[0] = LastTouchPos[1] = FVector2D::ZeroVector;
}

void AArchVizPlayerController::BeginPlay()
{
	Super::BeginPlay();

	if (IsLocalController())
	{
		FInputModeGameAndUI InputMode;
		InputMode.SetHideCursorDuringCapture(false);
		InputMode.SetLockMouseToViewportBehavior(EMouseLockMode::DoNotLock);
		SetInputMode(InputMode);
	}
}

void AArchVizPlayerController::PlayerTick(float DeltaTime)
{
	Super::PlayerTick(DeltaTime);

	AArchVizCameraPawn* Camera = Cast<AArchVizCameraPawn>(GetPawn());
	if (!Camera || !bCameraInputEnabled)
	{
		return;
	}
	TickMouse(Camera);
	TickTouch(Camera);
}

void AArchVizPlayerController::TickMouse(AArchVizCameraPawn* Camera)
{
	float MouseX = 0.f, MouseY = 0.f;
	if (!GetMousePosition(MouseX, MouseY))
	{
		return;
	}
	const FVector2D Pos(MouseX, MouseY);

	if (WasInputKeyJustPressed(EKeys::LeftMouseButton) || WasInputKeyJustPressed(EKeys::RightMouseButton) || WasInputKeyJustPressed(EKeys::MiddleMouseButton))
	{
		MousePressPos = Pos;
		LastMousePos = Pos;
		bMouseDragging = false;
		NotifyActivity();
	}

	const bool bOrbitButton = IsInputKeyDown(EKeys::LeftMouseButton);
	const bool bPanButton = IsInputKeyDown(EKeys::RightMouseButton) || IsInputKeyDown(EKeys::MiddleMouseButton);
	if (bOrbitButton || bPanButton)
	{
		if (!bMouseDragging && FVector2D::Distance(Pos, MousePressPos) > DragThreshold)
		{
			bMouseDragging = true;
		}

		const FVector2D Delta = Pos - LastMousePos;
		if (bMouseDragging && !Delta.IsNearlyZero())
		{
			const bool bPan = bPanButton || IsInputKeyDown(EKeys::LeftShift) || IsInputKeyDown(EKeys::RightShift);
			if (bPan)
			{
				Camera->AddPanInput(Delta);
			}
			else
			{
				const float Pitch = static_cast<float>(bInvertPitch ? Delta.Y : -Delta.Y) * MouseOrbitSpeed;
				Camera->AddOrbitInput(static_cast<float>(Delta.X) * MouseOrbitSpeed, Pitch);
			}
			NotifyActivity();
		}
	}

	if (WasInputKeyJustReleased(EKeys::LeftMouseButton) && !bMouseDragging)
	{
		HandleClick(Pos);
	}
	LastMousePos = Pos;

	if (WasInputKeyJustPressed(EKeys::MouseScrollUp))
	{
		Camera->AddZoomInput(1.f);
		NotifyActivity();
	}
	if (WasInputKeyJustPressed(EKeys::MouseScrollDown))
	{
		Camera->AddZoomInput(-1.f);
		NotifyActivity();
	}
}

void AArchVizPlayerController::TickTouch(AArchVizCameraPawn* Camera)
{
	bool bDown[2] = { false, false };
	FVector2D Pos[2];
	for (int32 Finger = 0; Finger < 2; ++Finger)
	{
		float X = 0.f, Y = 0.f;
		GetInputTouchState(static_cast<ETouchIndex::Type>(Finger), X, Y, bDown[Finger]);
		Pos[Finger] = FVector2D(X, Y);
	}

	if (bDown[0] && bDown[1])
	{
		const float Distance = static_cast<float>(FVector2D::Distance(Pos[0], Pos[1]));
		const FVector2D Center = (Pos[0] + Pos[1]) * 0.5;
		if (bTouchWasDown[0] && bTouchWasDown[1])
		{
			const FVector2D LastCenter = (LastTouchPos[0] + LastTouchPos[1]) * 0.5;
			Camera->AddZoomInput((Distance - LastPinchDistance) / PinchPixelsPerStep);
			Camera->AddPanInput(Center - LastCenter);
			NotifyActivity();
		}
		LastPinchDistance = Distance;
		bTouchDragging = true; // a two-finger gesture is never a tap
	}
	else if (bDown[0])
	{
		if (!bTouchWasDown[0])
		{
			TouchPressPos = Pos[0];
			bTouchDragging = false;
			NotifyActivity();
		}
		else if (bTouchWasDown[1])
		{
			// Second finger lifted: re-anchor so the view does not jump.
			bTouchDragging = true;
		}
		else
		{
			if (!bTouchDragging && FVector2D::Distance(Pos[0], TouchPressPos) > DragThreshold)
			{
				bTouchDragging = true;
			}
			const FVector2D Delta = Pos[0] - LastTouchPos[0];
			if (bTouchDragging && !Delta.IsNearlyZero())
			{
				const float Pitch = static_cast<float>(bInvertPitch ? Delta.Y : -Delta.Y) * TouchOrbitSpeed;
				Camera->AddOrbitInput(static_cast<float>(Delta.X) * TouchOrbitSpeed, Pitch);
				NotifyActivity();
			}
		}
	}
	else if (bTouchWasDown[0] && !bTouchWasDown[1] && !bTouchDragging)
	{
		HandleClick(LastTouchPos[0]);
	}

	for (int32 Finger = 0; Finger < 2; ++Finger)
	{
		if (bDown[Finger])
		{
			LastTouchPos[Finger] = Pos[Finger];
		}
		bTouchWasDown[Finger] = bDown[Finger];
	}
}

void AArchVizPlayerController::HandleClick_Implementation(FVector2D ScreenPosition)
{
	NotifyActivity();

	FHitResult Hit;
	if (!GetHitResultAtScreenPosition(ScreenPosition, ECC_Visibility, false, Hit))
	{
		return;
	}
	AActor* HitActor = Hit.GetActor();
	UArchVizSceneSubsystem* Scene = GetWorld()->GetSubsystem<UArchVizSceneSubsystem>();
	if (!HitActor || !Scene)
	{
		return;
	}

	if (const UArchVizUnitComponent* Unit = HitActor->FindComponentByClass<UArchVizUnitComponent>())
	{
		Scene->NotifyUnitClicked(Unit->UnitId);
	}
	else if (AArchVizPOI* POI = Cast<AArchVizPOI>(HitActor))
	{
		Scene->NotifyPOIClicked(POI);
	}
}

void AArchVizPlayerController::NotifyActivity() const
{
	if (const UGameInstance* GameInstance = GetGameInstance())
	{
		if (UArchVizAppSubsystem* App = GameInstance->GetSubsystem<UArchVizAppSubsystem>())
		{
			App->NotifyUserActivity();
		}
	}
}
