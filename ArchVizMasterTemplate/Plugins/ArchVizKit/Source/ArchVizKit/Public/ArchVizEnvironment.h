#pragma once

#include "CoreMinimal.h"
#include "GameFramework/Actor.h"
#include "ArchVizTypes.h"
#include "ArchVizEnvironment.generated.h"

class ADirectionalLight;
class ASkyLight;
class AExponentialHeightFog;
class UMaterialParameterCollection;

/** One weather look. Values are blended, so presets crossfade instead of popping. */
USTRUCT(BlueprintType)
struct ARCHVIZKIT_API FArchVizWeatherSettings
{
	GENERATED_BODY()

	/** 0..1, written to the MPC for your volumetric cloud material. */
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Weather")
	float CloudCoverage = 0.2f;

	/** Multiplies the fog actor's density as placed in the level. */
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Weather")
	float FogDensityScale = 1.f;

	/** Multiplies the sun's intensity as placed in the level. */
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Weather")
	float SunIntensityScale = 1.f;

	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Weather")
	float SkyIntensityScale = 1.f;

	/** 0..1 puddles / wet surfaces (MPC "Wetness"). */
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Weather")
	float Wetness = 0.f;

	/** 0..1 rain amount (MPC "Rain"); rain FX actors show above 0.05. */
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Weather")
	float Rain = 0.f;

	/** 0..1 falling snow (MPC "Snowfall"); snow FX actors show above 0.05. */
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Weather")
	float Snowfall = 0.f;

	/** 0..1 foliage wind (MPC "Wind"). */
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Weather")
	float Wind = 0.2f;
};

USTRUCT(BlueprintType)
struct ARCHVIZKIT_API FArchVizActorList
{
	GENERATED_BODY()

	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "ArchViz")
	TArray<TObjectPtr<AActor>> Actors;
};

DECLARE_DYNAMIC_MULTICAST_DELEGATE(FArchVizEnvironmentChanged);
DECLARE_DYNAMIC_MULTICAST_DELEGATE_OneParam(FArchVizNightChanged, bool, bIsNight);

/**
 * Drives time of day, weather and season. Place one per level and point it at the sun,
 * sky light and fog (all Movable). Every value is also mirrored into a Material Parameter
 * Collection so materials can react: TimeOfDay, SunElevation, NightFactor, CloudCoverage,
 * Wetness, Rain, Snowfall, SnowCover, Autumn, Season, Wind.
 */
UCLASS(ClassGroup = (ArchViz))
class ARCHVIZKIT_API AArchVizEnvironment : public AActor
{
	GENERATED_BODY()

public:
	AArchVizEnvironment();

	virtual void Tick(float DeltaSeconds) override;

	/** Hours 0..24. BlendSeconds > 0 animates the sun the short way round the clock (preset buttons). */
	UFUNCTION(BlueprintCallable, Category = "ArchViz|Environment")
	void SetTimeOfDay(float Hours, float BlendSeconds = 0.f);

	UFUNCTION(BlueprintPure, Category = "ArchViz|Environment")
	float GetTimeOfDay() const { return TimeOfDay; }

	/** Day of year 1..365; changes the sun path. */
	UFUNCTION(BlueprintCallable, Category = "ArchViz|Environment")
	void SetDate(int32 Month, int32 Day);

	UFUNCTION(BlueprintCallable, Category = "ArchViz|Environment")
	void SetWeather(EArchVizWeather Weather, float BlendSeconds = 3.f);

	UFUNCTION(BlueprintPure, Category = "ArchViz|Environment")
	EArchVizWeather GetWeather() const { return CurrentWeather; }

	UFUNCTION(BlueprintCallable, Category = "ArchViz|Environment")
	void SetSeason(EArchVizSeason Season, float BlendSeconds = 2.f);

	UFUNCTION(BlueprintPure, Category = "ArchViz|Environment")
	EArchVizSeason GetSeason() const { return CurrentSeason; }

	/** Hours per real second; 0 stops. For time-lapse presentations. */
	UFUNCTION(BlueprintCallable, Category = "ArchViz|Environment")
	void SetTimeLapse(float HoursPerSecond);

	UFUNCTION(BlueprintPure, Category = "ArchViz|Environment")
	bool IsNight() const { return bIsNight; }

	/** Sun elevation / azimuth in degrees (azimuth clockwise from true north). */
	UFUNCTION(BlueprintPure, Category = "ArchViz|Environment")
	void GetSunAngles(float& OutElevation, float& OutAzimuth) const;

	/**
	 * NOAA solar position. Hours is local clock time, UtcOffset in hours.
	 * Returns elevation and azimuth (clockwise from north) in degrees.
	 */
	UFUNCTION(BlueprintPure, Category = "ArchViz|Environment")
	static void ComputeSunPosition(float Latitude, float Longitude, float UtcOffset, int32 InDayOfYear, float Hours, float& OutElevation, float& OutAzimuth);

	/** Fired when time, weather or season changes (keep UI controls in sync). */
	UPROPERTY(BlueprintAssignable, Category = "ArchViz|Environment")
	FArchVizEnvironmentChanged OnEnvironmentChanged;

	UPROPERTY(BlueprintAssignable, Category = "ArchViz|Environment")
	FArchVizNightChanged OnNightChanged;

	// --- Scene references ----------------------------------------------------
	UPROPERTY(EditInstanceOnly, BlueprintReadOnly, Category = "ArchViz|Scene")
	TObjectPtr<ADirectionalLight> Sun;

	UPROPERTY(EditInstanceOnly, BlueprintReadOnly, Category = "ArchViz|Scene")
	TObjectPtr<ASkyLight> SkyLight;

	UPROPERTY(EditInstanceOnly, BlueprintReadOnly, Category = "ArchViz|Scene")
	TObjectPtr<AExponentialHeightFog> Fog;

	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "ArchViz|Scene")
	TObjectPtr<UMaterialParameterCollection> Parameters;

	/** Rain particle actors, shown while it rains. */
	UPROPERTY(EditInstanceOnly, BlueprintReadOnly, Category = "ArchViz|Scene")
	TArray<TObjectPtr<AActor>> RainActors;

	UPROPERTY(EditInstanceOnly, BlueprintReadOnly, Category = "ArchViz|Scene")
	TArray<TObjectPtr<AActor>> SnowfallActors;

	/** Street lights, window glow, pool lights: shown only at night. */
	UPROPERTY(EditInstanceOnly, BlueprintReadOnly, Category = "ArchViz|Scene")
	TArray<TObjectPtr<AActor>> NightActors;

	/** Actors visible only in a given season (autumn leaves, snow piles, Christmas tree...). */
	UPROPERTY(EditInstanceOnly, BlueprintReadOnly, Category = "ArchViz|Scene")
	TMap<EArchVizSeason, FArchVizActorList> SeasonActors;

	// --- Settings ------------------------------------------------------------
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "ArchViz|Environment")
	TMap<EArchVizWeather, FArchVizWeatherSettings> WeatherPresets;

	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "ArchViz|Environment", meta = (ClampMin = 0, ClampMax = 24))
	float TimeOfDay = 13.5f;

	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "ArchViz|Environment", meta = (ClampMin = 1, ClampMax = 365))
	int32 DayOfYear = 172;

	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "ArchViz|Environment")
	EArchVizWeather StartWeather = EArchVizWeather::Clear;

	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "ArchViz|Environment")
	EArchVizSeason StartSeason = EArchVizSeason::Summer;

	/** Selecting a season also moves the date to mid-season so the sun path matches. */
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "ArchViz|Environment")
	bool bSeasonSetsDate = true;

	/** Used when no project asset is configured. */
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "ArchViz|Environment|Fallback Site")
	float FallbackLatitude = 52.23f;

	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "ArchViz|Environment|Fallback Site")
	float FallbackLongitude = 21.01f;

	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "ArchViz|Environment|Fallback Site")
	float FallbackUtcOffset = 1.f;

	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "ArchViz|Environment|Fallback Site")
	float FallbackNorthYaw = 0.f;

protected:
	virtual void BeginPlay() override;

private:
	struct FBlendState
	{
		FArchVizWeatherSettings Weather;
		float SnowCover = 0.f;
		float Autumn = 0.f;
	};

	static FBlendState LerpState(const FBlendState& A, const FBlendState& B, float Alpha);
	FBlendState MakeTargetState() const;
	void StartBlend(float BlendSeconds);
	void ApplyAll();
	void ApplySun(float Elevation, float Azimuth);
	void SetScalar(FName Name, float Value) const;
	static void SetActorsShown(const TArray<TObjectPtr<AActor>>& Actors, bool bShown);
	void ApplySeasonActors() const;
	void UpdateTickEnabled();
	void GetSite(float& Lat, float& Lon, float& Utc, float& NorthYaw) const;

	EArchVizWeather CurrentWeather = EArchVizWeather::Clear;
	EArchVizSeason CurrentSeason = EArchVizSeason::Summer;

	FBlendState Current;
	FBlendState BlendFrom;
	FBlendState BlendTo;
	float BlendTime = 0.f;
	float BlendDuration = 0.f;
	bool bBlending = false;

	float TimeTarget = 0.f;
	float TimeSpeed = 0.f; // hours per second while animating to TimeTarget
	bool bAnimatingTime = false;
	float TimeLapseSpeed = 0.f;

	float SunElevation = 0.f;
	float SunAzimuth = 0.f;
	bool bIsNight = false;
	bool bNightInitialized = false;

	float BaseSunIntensity = 10.f;
	float BaseSkyIntensity = 1.f;
	float BaseFogDensity = 0.02f;
	bool bRainShown = false;
	bool bSnowShown = false;

	/** Static (non real-time) sky lights are recaptured at most every 0.25 s while values change. */
	bool bSkyNeedsRecapture = false;
	double LastSkyRecapture = -1.0;
};
