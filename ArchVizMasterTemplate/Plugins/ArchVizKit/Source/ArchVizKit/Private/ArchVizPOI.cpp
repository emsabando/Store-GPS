#include "ArchVizPOI.h"

#include "ArchVizSceneSubsystem.h"
#include "Components/WidgetComponent.h"
#include "Engine/World.h"

void UArchVizPOILabelWidget::SelectPOI()
{
	if (POI)
	{
		POI->Select();
	}
}

AArchVizPOI::AArchVizPOI()
{
	PrimaryActorTick.bCanEverTick = false;

	RootComponent = CreateDefaultSubobject<USceneComponent>(TEXT("Root"));

	Label = CreateDefaultSubobject<UWidgetComponent>(TEXT("Label"));
	Label->SetupAttachment(RootComponent);
	Label->SetWidgetSpace(EWidgetSpace::Screen); // constant size, always faces the viewer
	Label->SetDrawAtDesiredSize(true);
	Label->SetPivot(FVector2D(0.5, 1.0));        // anchor the bottom of the label on the spot
	Label->SetCollisionEnabled(ECollisionEnabled::NoCollision);
}

void AArchVizPOI::BeginPlay()
{
	Super::BeginPlay(); // the widget component creates its widget here

	if (UArchVizPOILabelWidget* Widget = Cast<UArchVizPOILabelWidget>(Label->GetUserWidgetObject()))
	{
		Widget->POI = this;
		Widget->OnPOIAssigned();
	}

	if (UArchVizSceneSubsystem* Scene = GetWorld()->GetSubsystem<UArchVizSceneSubsystem>())
	{
		Scene->RegisterPOI(this);
	}
}

void AArchVizPOI::EndPlay(const EEndPlayReason::Type EndPlayReason)
{
	if (UWorld* World = GetWorld())
	{
		if (UArchVizSceneSubsystem* Scene = World->GetSubsystem<UArchVizSceneSubsystem>())
		{
			Scene->UnregisterPOI(this);
		}
	}
	Super::EndPlay(EndPlayReason);
}

void AArchVizPOI::Select()
{
	if (UArchVizSceneSubsystem* Scene = GetWorld()->GetSubsystem<UArchVizSceneSubsystem>())
	{
		Scene->NotifyPOIClicked(this);
	}
}

void AArchVizPOI::SetLabelVisible(bool bVisible)
{
	Label->SetVisibility(bVisible);
	if (UUserWidget* Widget = Label->GetUserWidgetObject())
	{
		Widget->SetVisibility(bVisible ? ESlateVisibility::Visible : ESlateVisibility::Collapsed);
	}
}

void AArchVizPOI::SetFocused(bool bInFocused)
{
	if (bFocused == bInFocused)
	{
		return;
	}
	bFocused = bInFocused;
	if (UArchVizPOILabelWidget* Widget = Cast<UArchVizPOILabelWidget>(Label->GetUserWidgetObject()))
	{
		Widget->OnPOIFocusChanged(bFocused);
	}
	OnFocusChanged(bFocused);
}
