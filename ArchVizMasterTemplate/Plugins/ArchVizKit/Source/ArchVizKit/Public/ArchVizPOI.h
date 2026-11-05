#pragma once

#include "CoreMinimal.h"
#include "Blueprint/UserWidget.h"
#include "GameFramework/Actor.h"
#include "ArchVizPOI.generated.h"

class UTexture2D;
class UWidgetComponent;
class AArchVizPOI;

/**
 * Base class for the floating hotspot label ("Padel court", "Rooftop garden").
 * Reparent your label widget to this; bind its button to SelectPOI.
 */
UCLASS(Abstract)
class ARCHVIZKIT_API UArchVizPOILabelWidget : public UUserWidget
{
	GENERATED_BODY()

public:
	UPROPERTY(BlueprintReadOnly, Category = "ArchViz")
	TObjectPtr<AArchVizPOI> POI;

	UFUNCTION(BlueprintCallable, Category = "ArchViz")
	void SelectPOI();

	/** POI is assigned: fill title, icon, category colour. */
	UFUNCTION(BlueprintImplementableEvent, Category = "ArchViz")
	void OnPOIAssigned();

	/** This POI became / stopped being the focused amenity. */
	UFUNCTION(BlueprintImplementableEvent, Category = "ArchViz")
	void OnPOIFocusChanged(bool bFocused);
};

/**
 * Amenity / point of interest: padel court, playground, rooftop garden, metro entrance...
 * Shows a floating label, and when selected the app flies to its camera shot and opens
 * its card (title, description, gallery, first-person button).
 */
UCLASS(ClassGroup = (ArchViz))
class ARCHVIZKIT_API AArchVizPOI : public AActor
{
	GENERATED_BODY()

public:
	AArchVizPOI();

	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "ArchViz")
	FName PoiId;

	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "ArchViz")
	FText Title;

	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "ArchViz", meta = (MultiLine = true))
	FText Description;

	/** Filter group for the amenity list: Sport, Kids, Leisure, Retail, Parking, Transport... */
	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "ArchViz")
	FName Category;

	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "ArchViz")
	int32 Order = 0;

	/** Small tag on the card, e.g. "Deluxe Premium", "Residents only". */
	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "ArchViz")
	FText Badge;

	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "ArchViz")
	TSoftObjectPtr<UTexture2D> Thumbnail;

	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "ArchViz")
	TArray<TSoftObjectPtr<UTexture2D>> Gallery;

	/** Optional video / 360 tour link for the media gallery. */
	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "ArchViz")
	FString MediaUrl;

	/** Camera shot to fly to when selected. None = frame the POI from the current angle. */
	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "ArchViz")
	FName ShotId;

	/** Where the "first-person view" button drops the visitor. Null hides the button. */
	UPROPERTY(EditInstanceOnly, BlueprintReadOnly, Category = "ArchViz")
	TObjectPtr<AActor> FirstPersonStart;

	UFUNCTION(BlueprintPure, Category = "ArchViz")
	bool HasFirstPerson() const { return FirstPersonStart != nullptr; }

	/** Same as clicking the label. */
	UFUNCTION(BlueprintCallable, Category = "ArchViz")
	void Select();

	UFUNCTION(BlueprintCallable, Category = "ArchViz")
	void SetLabelVisible(bool bVisible);

	/** Called by the app when this POI becomes / stops being the focused amenity. */
	UFUNCTION(BlueprintCallable, Category = "ArchViz")
	void SetFocused(bool bInFocused);

	UFUNCTION(BlueprintPure, Category = "ArchViz")
	bool IsFocused() const { return bFocused; }

	UFUNCTION(BlueprintImplementableEvent, Category = "ArchViz")
	void OnFocusChanged(bool bIsFocused);

protected:
	virtual void BeginPlay() override;
	virtual void EndPlay(const EEndPlayReason::Type EndPlayReason) override;

	UPROPERTY(VisibleAnywhere, BlueprintReadOnly, Category = "ArchViz")
	TObjectPtr<UWidgetComponent> Label;

private:
	bool bFocused = false;
};
