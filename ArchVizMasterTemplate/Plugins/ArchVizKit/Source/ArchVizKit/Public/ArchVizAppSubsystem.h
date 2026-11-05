#pragma once

#include "CoreMinimal.h"
#include "Engine/EngineTypes.h"
#include "Subsystems/GameInstanceSubsystem.h"
#include "ArchVizTypes.h"
#include "ArchVizAppSubsystem.generated.h"

class AArchVizCameraPawn;
class FJsonObject;
class AArchVizEnvironment;
class AArchVizPOI;
class UArchVizInventorySubsystem;
class UArchVizSceneSubsystem;
class APawn;

/** Where the visitor is. One value per screen of the app. */
USTRUCT(BlueprintType)
struct ARCHVIZKIT_API FArchVizAppState
{
	GENERATED_BODY()

	UPROPERTY(BlueprintReadOnly, Category = "ArchViz")
	EArchVizMode Mode = EArchVizMode::Masterplan;

	UPROPERTY(BlueprintReadOnly, Category = "ArchViz")
	FName Building;

	/** Valid in Floor, Unit and Interior modes. */
	UPROPERTY(BlueprintReadOnly, Category = "ArchViz")
	int32 Floor = 0;

	/** Section cut active at Building / Floor (Floor mode, and Unit mode when entered from it). */
	UPROPERTY(BlueprintReadOnly, Category = "ArchViz")
	bool bSectionActive = false;

	UPROPERTY(BlueprintReadOnly, Category = "ArchViz")
	FName UnitId;

	UPROPERTY(BlueprintReadOnly, Category = "ArchViz")
	FName PoiId;

	/** Current camera shot (interior viewpoint, tour stop). */
	UPROPERTY(BlueprintReadOnly, Category = "ArchViz")
	FName ShotId;
};

/** Enquiry form ("Contact", "Request a call", "Book a viewing"). */
USTRUCT(BlueprintType)
struct ARCHVIZKIT_API FArchVizLead
{
	GENERATED_BODY()

	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "ArchViz")
	FString Name;

	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "ArchViz")
	FString Phone;

	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "ArchViz")
	FString Email;

	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "ArchViz")
	FString Message;

	/** Unit the enquiry is about (None = general). Favourites are attached automatically. */
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "ArchViz")
	FName UnitId;

	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "ArchViz")
	bool bMarketingConsent = false;
};

DECLARE_DYNAMIC_MULTICAST_DELEGATE_TwoParams(FArchVizModeChanged, EArchVizMode, NewMode, EArchVizMode, OldMode);
DECLARE_DYNAMIC_MULTICAST_DELEGATE(FArchVizStateChanged);
DECLARE_DYNAMIC_MULTICAST_DELEGATE_OneParam(FArchVizBoolEvent, bool, bValue);
DECLARE_DYNAMIC_MULTICAST_DELEGATE_OneParam(FArchVizMessage, const FString&, Json);
DECLARE_DYNAMIC_MULTICAST_DELEGATE_TwoParams(FArchVizCommand, const FString&, Command, const FString&, ArgsJson);
DECLARE_DYNAMIC_MULTICAST_DELEGATE_TwoParams(FArchVizLeadResult, bool, bSuccess, int32, HttpCode);

/**
 * The app's brain: navigation between modes with a real back stack, kiosk idle detection,
 * lead capture, and a JSON command bridge so the same app can be driven by UMG,
 * a Pixel Streaming web page, or a sales-office tablet.
 *
 * UMG and web UIs should only call into this subsystem and listen to its events;
 * they never talk to the camera, scene or environment directly.
 */
UCLASS()
class ARCHVIZKIT_API UArchVizAppSubsystem : public UGameInstanceSubsystem
{
	GENERATED_BODY()

public:
	virtual void Initialize(FSubsystemCollectionBase& Collection) override;
	virtual void Deinitialize() override;

	// --- State -----------------------------------------------------------------
	UFUNCTION(BlueprintPure, Category = "ArchViz|App")
	FArchVizAppState GetState() const { return State; }

	UFUNCTION(BlueprintPure, Category = "ArchViz|App")
	EArchVizMode GetMode() const { return State.Mode; }

	UFUNCTION(BlueprintPure, Category = "ArchViz|App")
	bool CanGoBack() const { return History.Num() > 0; }

	// --- Navigation ---------------------------------------------------------------
	/** Masterplan view: clears selection and section, flies to shot "Home". */
	UFUNCTION(BlueprintCallable, Category = "ArchViz|App")
	void GoHome();

	/** Returns to the previous screen and its exact camera view. */
	UFUNCTION(BlueprintCallable, Category = "ArchViz|App")
	void Back();

	/** Flies to shot "Building_<Id>" if present. */
	UFUNCTION(BlueprintCallable, Category = "ArchViz|App")
	void SelectBuilding(FName Building);

	/** Section cut at this floor; flies to shot "Section_<Building>" if present. */
	UFUNCTION(BlueprintCallable, Category = "ArchViz|App")
	void SelectFloor(FName Building, int32 Floor);

	/** Highlights the unit and frames it (or flies to shot "Unit_<Id>"). */
	UFUNCTION(BlueprintCallable, Category = "ArchViz|App")
	void SelectUnit(FName UnitId);

	/** Into the show-flat of the unit's type. ShotId None = the type's first viewpoint. */
	UFUNCTION(BlueprintCallable, Category = "ArchViz|App")
	void EnterInterior(FName UnitId, FName ShotId);

	/** Hop between floor-plan viewpoints inside the interior (does not grow the back stack). */
	UFUNCTION(BlueprintCallable, Category = "ArchViz|App")
	void SelectViewpoint(FName ShotId);

	UFUNCTION(BlueprintCallable, Category = "ArchViz|App")
	void FocusAmenity(AArchVizPOI* POI);

	UFUNCTION(BlueprintCallable, Category = "ArchViz|App")
	void FocusAmenityById(FName PoiId);

	/** Possess the project's first-person pawn at the POI's start point (or the given transform). */
	UFUNCTION(BlueprintCallable, Category = "ArchViz|App")
	void EnterFirstPerson(FTransform Start);

	UFUNCTION(BlueprintCallable, Category = "ArchViz|App")
	void EnterFirstPersonAtPOI(AArchVizPOI* POI);

	UFUNCTION(BlueprintCallable, Category = "ArchViz|App")
	void ExitFirstPerson();

	/** Camera bookmark without changing mode. Duration < 0 uses the shot's own. */
	UFUNCTION(BlueprintCallable, Category = "ArchViz|App")
	void GoToShot(FName ShotId, float Duration = -1.f);

	/** Hide the whole UI and hotspot labels (clean view / screenshots). */
	UFUNCTION(BlueprintCallable, Category = "ArchViz|App")
	void SetUIHidden(bool bHidden);

	UFUNCTION(BlueprintPure, Category = "ArchViz|App")
	bool IsUIHidden() const { return bUIHidden; }

	// --- Kiosk ------------------------------------------------------------------
	/** Call on any input (the bundled player controller does). */
	UFUNCTION(BlueprintCallable, Category = "ArchViz|Kiosk")
	void NotifyUserActivity();

	UFUNCTION(BlueprintPure, Category = "ArchViz|Kiosk")
	bool IsIdle() const { return bIsIdle; }

	/** When the visitor walks away: back to Home, filter and favourites cleared for the next one. */
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "ArchViz|Kiosk")
	bool bResetSessionOnIdle = true;

	/** Turntable while idle (camera pawn auto-rotate). Bind OnIdleChanged for a sequence instead. */
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "ArchViz|Kiosk")
	bool bAutoRotateWhenIdle = true;

	// --- Bridge -----------------------------------------------------------------
	/**
	 * Run a command such as {"cmd":"selectUnit","unitId":"345"}. See docs/BRIDGE_PROTOCOL.md.
	 * Unknown commands are forwarded to OnUnhandledCommand. Returns false on malformed JSON.
	 */
	UFUNCTION(BlueprintCallable, Category = "ArchViz|Bridge")
	bool HandleCommandJson(const FString& Json);

	/** Broadcast the full state as a {"type":"state"} message. */
	UFUNCTION(BlueprintCallable, Category = "ArchViz|Bridge")
	void SendStateToUI();

	// --- Sales ------------------------------------------------------------------
	/** POST the lead to the project's LeadWebhookUrl as JSON. */
	UFUNCTION(BlueprintCallable, Category = "ArchViz|Sales")
	void SubmitLead(const FArchVizLead& Lead);

	// --- Events -----------------------------------------------------------------
	UPROPERTY(BlueprintAssignable, Category = "ArchViz|App")
	FArchVizModeChanged OnModeChanged;

	/** Any change to the state struct (mode, unit, floor, POI, shot). */
	UPROPERTY(BlueprintAssignable, Category = "ArchViz|App")
	FArchVizStateChanged OnStateChanged;

	UPROPERTY(BlueprintAssignable, Category = "ArchViz|App")
	FArchVizBoolEvent OnUIHiddenChanged;

	UPROPERTY(BlueprintAssignable, Category = "ArchViz|Kiosk")
	FArchVizBoolEvent OnIdleChanged;

	/** Outgoing JSON for a web UI. Forward to Pixel Streaming's "Send Pixel Streaming Response". */
	UPROPERTY(BlueprintAssignable, Category = "ArchViz|Bridge")
	FArchVizMessage OnOutgoingMessage;

	/** Project-specific commands the kit does not know. */
	UPROPERTY(BlueprintAssignable, Category = "ArchViz|Bridge")
	FArchVizCommand OnUnhandledCommand;

	UPROPERTY(BlueprintAssignable, Category = "ArchViz|Sales")
	FArchVizLeadResult OnLeadSubmitted;

	// Called by the scene subsystem.
	void HandleUnitClicked(FName UnitId);
	void HandlePOIClicked(AArchVizPOI* POI);

private:
	struct FHistoryEntry
	{
		FArchVizAppState State;
		bool bHasCamera = false;
		FVector Pivot = FVector::ZeroVector;
		float Yaw = 0.f;
		float Pitch = 0.f;
		float Arm = 0.f;
		float FOV = 60.f;
		bool bLookAround = false;
	};

	void PushHistory();
	void SetState(const FArchVizAppState& NewState, bool bPushHistory);
	void ApplySceneForState(const FArchVizAppState& OldState);
	bool FlyToShotId(FName ShotId, float Duration = -1.f) const;
	void EnsureInteriorLoaded(FName UnitId);
	void UnloadInterior();
	void ResetSession();
	void GoHomeInternal(bool bPushHistory);
	void LeaveFirstPersonIfActive();
	void FrameUnit(FName UnitId) const;
	void CheckIdle();
	void SendMessage(const TSharedRef<FJsonObject>& Message) const;
	void SendUnits(const TArray<FArchVizUnitRow>& Units, const FString& Type) const;

	UFUNCTION()
	void HandleInteriorLoaded();

	UFUNCTION()
	void HandleResultsChanged(const TArray<FName>& UnitIds);

	UFUNCTION()
	void HandleFavoritesChanged();

	UWorld* GetCurrentWorld() const;
	UArchVizSceneSubsystem* GetScene() const;
	UArchVizInventorySubsystem* GetInventory() const;
	AArchVizCameraPawn* GetCameraPawn() const;
	AArchVizEnvironment* GetEnvironment() const;

	FArchVizAppState State;
	TArray<FHistoryEntry> History;
	bool bUIHidden = false;

	// First person
	TWeakObjectPtr<APawn> FirstPersonPawn;
	TWeakObjectPtr<AArchVizCameraPawn> SavedCameraPawn;

	// Interior streaming
	TSoftObjectPtr<UWorld> LoadedInterior;
	FName PendingInteriorShot;
	bool bInteriorLoading = false;
	int32 LatentCounter = 0;

	// Idle
	double LastActivityTime = 0.0;
	double IdleStartTime = 0.0;
	bool bIsIdle = false;
	FTimerHandle IdleTimer;
};
