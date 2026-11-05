#include "ArchVizCameraShot.h"

#include "ArchVizSceneSubsystem.h"
#include "Camera/CameraComponent.h"
#include "Engine/World.h"

AArchVizCameraShot::AArchVizCameraShot()
{
	PrimaryActorTick.bCanEverTick = false;

	Camera = CreateDefaultSubobject<UCameraComponent>(TEXT("Camera"));
	Camera->SetFieldOfView(60.f);
	Camera->bConstrainAspectRatio = false;
	RootComponent = Camera;
}

FVector AArchVizCameraShot::GetPivotLocation() const
{
	const FVector Lens = GetActorLocation();
	return bLookAroundOnly ? Lens : Lens + GetActorForwardVector() * OrbitDistance;
}

float AArchVizCameraShot::GetFieldOfView() const
{
	return Camera ? Camera->FieldOfView : 60.f;
}

void AArchVizCameraShot::BeginPlay()
{
	Super::BeginPlay();
	if (UArchVizSceneSubsystem* Scene = GetWorld()->GetSubsystem<UArchVizSceneSubsystem>())
	{
		Scene->RegisterShot(this);
	}
}

void AArchVizCameraShot::EndPlay(const EEndPlayReason::Type EndPlayReason)
{
	if (UWorld* World = GetWorld())
	{
		if (UArchVizSceneSubsystem* Scene = World->GetSubsystem<UArchVizSceneSubsystem>())
		{
			Scene->UnregisterShot(this);
		}
	}
	Super::EndPlay(EndPlayReason);
}
