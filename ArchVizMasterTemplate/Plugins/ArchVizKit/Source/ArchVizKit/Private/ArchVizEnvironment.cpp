#include "ArchVizEnvironment.h"

#include "ArchVizInventorySubsystem.h"
#include "ArchVizProjectAsset.h"
#include "Components/ExponentialHeightFogComponent.h"
#include "Components/LightComponent.h"
#include "Components/SkyLightComponent.h"
#include "Engine/DirectionalLight.h"
#include "Engine/ExponentialHeightFog.h"
#include "Engine/GameInstance.h"
#include "Engine/SkyLight.h"
#include "Engine/World.h"
#include "Materials/MaterialParameterCollection.h"
#include "Materials/MaterialParameterCollectionInstance.h"
#include "Particles/ParticleSystemComponent.h"

namespace
{
	FArchVizWeatherSettings MakePreset(float Cloud, float Fog, float Sun, float Sky, float Wet, float Rain, float Snow, float Wind)
	{
		FArchVizWeatherSettings S;
		S.CloudCoverage = Cloud;
		S.FogDensityScale = Fog;
		S.SunIntensityScale = Sun;
		S.SkyIntensityScale = Sky;
		S.Wetness = Wet;
		S.Rain = Rain;
		S.Snowfall = Snow;
		S.Wind = Wind;
		return S;
	}

	float Wrap24(float Hours)
	{
		Hours = FMath::Fmod(Hours, 24.f);
		return Hours < 0.f ? Hours + 24.f : Hours;
	}

	/** Shortest signed difference B - A on a 24 h clock, in (-12, 12]. */
	float ClockDelta(float A, float B)
	{
		float D = B - A;
		if (D > 12.f) D -= 24.f;
		else if (D <= -12.f) D += 24.f;
		return D;
	}
}

AArchVizEnvironment::AArchVizEnvironment()
{
	PrimaryActorTick.bCanEverTick = true;
	PrimaryActorTick.bStartWithTickEnabled = false;

	RootComponent = CreateDefaultSubobject<USceneComponent>(TEXT("Root"));

	//                                                       cloud  fog   sun   sky   wet  rain snow wind
	WeatherPresets.Add(EArchVizWeather::Clear,        MakePreset(0.15f, 1.0f, 1.0f, 1.0f, 0.f, 0.f, 0.f, 0.15f));
	WeatherPresets.Add(EArchVizWeather::PartlyCloudy, MakePreset(0.45f, 1.2f, 0.85f, 0.95f, 0.f, 0.f, 0.f, 0.3f));
	WeatherPresets.Add(EArchVizWeather::Overcast,     MakePreset(0.9f, 1.8f, 0.35f, 0.75f, 0.1f, 0.f, 0.f, 0.4f));
	WeatherPresets.Add(EArchVizWeather::Fog,          MakePreset(0.6f, 6.0f, 0.4f, 0.8f, 0.2f, 0.f, 0.f, 0.05f));
	WeatherPresets.Add(EArchVizWeather::Rain,         MakePreset(1.0f, 2.5f, 0.2f, 0.6f, 1.f, 1.f, 0.f, 0.7f));
	WeatherPresets.Add(EArchVizWeather::Snow,         MakePreset(0.95f, 2.5f, 0.35f, 0.8f, 0.f, 0.f, 1.f, 0.3f));
}

void AArchVizEnvironment::BeginPlay()
{
	Super::BeginPlay();

	// The look the artist lit in the editor is the 100% reference for weather scaling.
	if (Sun && Sun->GetLightComponent())
	{
		BaseSunIntensity = Sun->GetLightComponent()->Intensity;
	}
	if (SkyLight && SkyLight->GetLightComponent())
	{
		BaseSkyIntensity = SkyLight->GetLightComponent()->Intensity;
	}
	if (Fog && Fog->GetComponent())
	{
		BaseFogDensity = Fog->GetComponent()->FogDensity;
	}

	TimeOfDay = Wrap24(TimeOfDay);
	CurrentWeather = StartWeather;
	CurrentSeason = StartSeason;
	Current = MakeTargetState();

	bRainShown = Current.Weather.Rain > 0.05f;
	bSnowShown = Current.Weather.Snowfall > 0.05f;
	SetActorsShown(RainActors, bRainShown);
	SetActorsShown(SnowfallActors, bSnowShown);
	ApplySeasonActors();

	ApplyAll();
}

void AArchVizEnvironment::Tick(float DeltaSeconds)
{
	Super::Tick(DeltaSeconds);

	bool bChanged = false;

	if (bBlending)
	{
		BlendTime += DeltaSeconds;
		const float Alpha = BlendDuration > 0.f ? FMath::Clamp(BlendTime / BlendDuration, 0.f, 1.f) : 1.f;
		Current = LerpState(BlendFrom, BlendTo, FMath::SmoothStep(0.f, 1.f, Alpha));
		if (Alpha >= 1.f)
		{
			bBlending = false;
		}
		bChanged = true;
	}

	if (bAnimatingTime)
	{
		const float Remaining = ClockDelta(TimeOfDay, TimeTarget);
		const float Step = TimeSpeed * DeltaSeconds;
		if (FMath::Abs(Remaining) <= FMath::Abs(Step))
		{
			TimeOfDay = TimeTarget;
			bAnimatingTime = false;
			OnEnvironmentChanged.Broadcast();
		}
		else
		{
			TimeOfDay = Wrap24(TimeOfDay + Step);
		}
		bChanged = true;
	}
	else if (!FMath::IsNearlyZero(TimeLapseSpeed))
	{
		TimeOfDay = Wrap24(TimeOfDay + TimeLapseSpeed * DeltaSeconds);
		bChanged = true;
	}

	if (bChanged)
	{
		ApplyAll();
	}

	if (bSkyNeedsRecapture && SkyLight && SkyLight->GetLightComponent())
	{
		const double Now = GetWorld()->GetTimeSeconds();
		if (Now - LastSkyRecapture >= 0.25)
		{
			SkyLight->GetLightComponent()->RecaptureSky();
			LastSkyRecapture = Now;
			bSkyNeedsRecapture = false;
		}
	}

	UpdateTickEnabled();
}

void AArchVizEnvironment::UpdateTickEnabled()
{
	SetActorTickEnabled(bBlending || bAnimatingTime || !FMath::IsNearlyZero(TimeLapseSpeed) || bSkyNeedsRecapture);
}

// --- Public controls -----------------------------------------------------------

void AArchVizEnvironment::SetTimeOfDay(float Hours, float BlendSeconds)
{
	Hours = Wrap24(Hours);
	if (BlendSeconds <= 0.f)
	{
		TimeOfDay = Hours;
		bAnimatingTime = false;
		ApplyAll();
		OnEnvironmentChanged.Broadcast();
	}
	else
	{
		const float Delta = ClockDelta(TimeOfDay, Hours);
		TimeTarget = Hours;
		TimeSpeed = Delta / BlendSeconds;
		bAnimatingTime = !FMath::IsNearlyZero(Delta);
	}
	UpdateTickEnabled();
}

void AArchVizEnvironment::SetDate(int32 Month, int32 Day)
{
	static const int32 DaysBeforeMonth[12] = { 0, 31, 59, 90, 120, 151, 181, 212, 243, 273, 304, 334 };
	Month = FMath::Clamp(Month, 1, 12);
	DayOfYear = FMath::Clamp(DaysBeforeMonth[Month - 1] + FMath::Clamp(Day, 1, 31), 1, 365);
	ApplyAll();
	OnEnvironmentChanged.Broadcast();
}

void AArchVizEnvironment::SetWeather(EArchVizWeather Weather, float BlendSeconds)
{
	CurrentWeather = Weather;
	StartBlend(BlendSeconds);
}

void AArchVizEnvironment::SetSeason(EArchVizSeason Season, float BlendSeconds)
{
	CurrentSeason = Season;
	if (bSeasonSetsDate)
	{
		switch (Season)
		{
		case EArchVizSeason::Spring: DayOfYear = 105; break; // 15 Apr
		case EArchVizSeason::Summer: DayOfYear = 196; break; // 15 Jul
		case EArchVizSeason::Autumn: DayOfYear = 288; break; // 15 Oct
		case EArchVizSeason::Winter: DayOfYear = 15;  break; // 15 Jan
		}
	}
	ApplySeasonActors();
	StartBlend(BlendSeconds);
}

void AArchVizEnvironment::SetTimeLapse(float HoursPerSecond)
{
	TimeLapseSpeed = HoursPerSecond;
	UpdateTickEnabled();
}

void AArchVizEnvironment::GetSunAngles(float& OutElevation, float& OutAzimuth) const
{
	OutElevation = SunElevation;
	OutAzimuth = SunAzimuth;
}

// --- Blending ----------------------------------------------------------------------

AArchVizEnvironment::FBlendState AArchVizEnvironment::MakeTargetState() const
{
	FBlendState State;
	if (const FArchVizWeatherSettings* Preset = WeatherPresets.Find(CurrentWeather))
	{
		State.Weather = *Preset;
	}
	State.SnowCover = CurrentSeason == EArchVizSeason::Winter ? 1.f : 0.f;
	State.Autumn = CurrentSeason == EArchVizSeason::Autumn ? 1.f : 0.f;
	return State;
}

AArchVizEnvironment::FBlendState AArchVizEnvironment::LerpState(const FBlendState& A, const FBlendState& B, float Alpha)
{
	FBlendState R;
	R.Weather.CloudCoverage = FMath::Lerp(A.Weather.CloudCoverage, B.Weather.CloudCoverage, Alpha);
	R.Weather.FogDensityScale = FMath::Lerp(A.Weather.FogDensityScale, B.Weather.FogDensityScale, Alpha);
	R.Weather.SunIntensityScale = FMath::Lerp(A.Weather.SunIntensityScale, B.Weather.SunIntensityScale, Alpha);
	R.Weather.SkyIntensityScale = FMath::Lerp(A.Weather.SkyIntensityScale, B.Weather.SkyIntensityScale, Alpha);
	R.Weather.Wetness = FMath::Lerp(A.Weather.Wetness, B.Weather.Wetness, Alpha);
	R.Weather.Rain = FMath::Lerp(A.Weather.Rain, B.Weather.Rain, Alpha);
	R.Weather.Snowfall = FMath::Lerp(A.Weather.Snowfall, B.Weather.Snowfall, Alpha);
	R.Weather.Wind = FMath::Lerp(A.Weather.Wind, B.Weather.Wind, Alpha);
	R.SnowCover = FMath::Lerp(A.SnowCover, B.SnowCover, Alpha);
	R.Autumn = FMath::Lerp(A.Autumn, B.Autumn, Alpha);
	return R;
}

void AArchVizEnvironment::StartBlend(float BlendSeconds)
{
	BlendTo = MakeTargetState();
	if (BlendSeconds <= 0.f)
	{
		Current = BlendTo;
		bBlending = false;
		ApplyAll();
	}
	else
	{
		BlendFrom = Current;
		BlendTime = 0.f;
		BlendDuration = BlendSeconds;
		bBlending = true;
	}
	UpdateTickEnabled();
	OnEnvironmentChanged.Broadcast();
}

// --- Applying -------------------------------------------------------------------------

void AArchVizEnvironment::GetSite(float& Lat, float& Lon, float& Utc, float& NorthYaw) const
{
	Lat = FallbackLatitude;
	Lon = FallbackLongitude;
	Utc = FallbackUtcOffset;
	NorthYaw = FallbackNorthYaw;

	const UGameInstance* GameInstance = GetGameInstance();
	const UArchVizInventorySubsystem* Inventory = GameInstance ? GameInstance->GetSubsystem<UArchVizInventorySubsystem>() : nullptr;
	if (const UArchVizProjectAsset* Project = Inventory ? Inventory->GetProject() : nullptr)
	{
		Lat = Project->Latitude;
		Lon = Project->Longitude;
		Utc = Project->UtcOffsetHours;
		NorthYaw = Project->NorthYaw;
	}
}

void AArchVizEnvironment::ApplyAll()
{
	float Lat, Lon, Utc, NorthYaw;
	GetSite(Lat, Lon, Utc, NorthYaw);
	ComputeSunPosition(Lat, Lon, Utc, DayOfYear, TimeOfDay, SunElevation, SunAzimuth);
	ApplySun(SunElevation, SunAzimuth);

	const FArchVizWeatherSettings& W = Current.Weather;
	const float DayFactor = FMath::SmoothStep(-4.f, 6.f, SunElevation);

	if (SkyLight && SkyLight->GetLightComponent())
	{
		USkyLightComponent* Sky = SkyLight->GetLightComponent();
		Sky->SetIntensity(BaseSkyIntensity * W.SkyIntensityScale * FMath::Lerp(0.08f, 1.f, DayFactor));
		if (!Sky->bRealTimeCapture)
		{
			bSkyNeedsRecapture = true;
		}
	}

	if (Fog && Fog->GetComponent())
	{
		Fog->GetComponent()->SetFogDensity(BaseFogDensity * W.FogDensityScale);
	}

	SetScalar(TEXT("TimeOfDay"), TimeOfDay);
	SetScalar(TEXT("SunElevation"), SunElevation);
	SetScalar(TEXT("NightFactor"), 1.f - DayFactor);
	SetScalar(TEXT("CloudCoverage"), W.CloudCoverage);
	SetScalar(TEXT("Wetness"), W.Wetness);
	SetScalar(TEXT("Rain"), W.Rain);
	SetScalar(TEXT("Snowfall"), W.Snowfall);
	SetScalar(TEXT("Wind"), W.Wind);
	SetScalar(TEXT("SnowCover"), Current.SnowCover);
	SetScalar(TEXT("Autumn"), Current.Autumn);
	SetScalar(TEXT("Season"), static_cast<float>(static_cast<uint8>(CurrentSeason)));

	const bool bRain = W.Rain > 0.05f;
	if (bRain != bRainShown)
	{
		bRainShown = bRain;
		SetActorsShown(RainActors, bRain);
	}
	const bool bSnow = W.Snowfall > 0.05f;
	if (bSnow != bSnowShown)
	{
		bSnowShown = bSnow;
		SetActorsShown(SnowfallActors, bSnow);
	}

	const bool bNight = SunElevation < -4.f;
	if (!bNightInitialized || bNight != bIsNight)
	{
		bNightInitialized = true;
		bIsNight = bNight;
		SetActorsShown(NightActors, bNight);
		OnNightChanged.Broadcast(bNight);
	}

	UpdateTickEnabled();
}

void AArchVizEnvironment::ApplySun(float Elevation, float Azimuth)
{
	if (!Sun)
	{
		return;
	}
	float Lat, Lon, Utc, NorthYaw;
	GetSite(Lat, Lon, Utc, NorthYaw);

	// Light travels away from the sun: yaw = sun azimuth + 180, pitched down by the elevation.
	// UE yaw grows clockwise seen from above, like a compass, so azimuth maps directly.
	Sun->SetActorRotation(FRotator(-Elevation, NorthYaw + Azimuth + 180.f, 0.f));

	if (ULightComponent* Light = Sun->GetLightComponent())
	{
		const float DayFactor = FMath::SmoothStep(-4.f, 6.f, Elevation);
		Light->SetIntensity(BaseSunIntensity * Current.Weather.SunIntensityScale * DayFactor);
	}
}

void AArchVizEnvironment::SetScalar(FName Name, float Value) const
{
	if (!Parameters)
	{
		return;
	}
	if (UMaterialParameterCollectionInstance* Instance = GetWorld()->GetParameterCollectionInstance(Parameters))
	{
		// Missing parameters are skipped, so a project only needs the ones its materials use.
		Instance->SetScalarParameterValue(Name, Value);
	}
}

void AArchVizEnvironment::SetActorsShown(const TArray<TObjectPtr<AActor>>& Actors, bool bShown)
{
	for (AActor* Actor : Actors)
	{
		if (!Actor)
		{
			continue;
		}
		Actor->SetActorHiddenInGame(!bShown);

		TInlineComponentArray<UFXSystemComponent*> Effects(Actor);
		for (UFXSystemComponent* Effect : Effects)
		{
			if (bShown)
			{
				Effect->Activate(true);
			}
			else
			{
				Effect->Deactivate();
			}
		}
	}
}

void AArchVizEnvironment::ApplySeasonActors() const
{
	// An actor may be listed in several seasons; it shows if the current one lists it.
	TSet<AActor*> Visible;
	if (const FArchVizActorList* List = SeasonActors.Find(CurrentSeason))
	{
		for (AActor* Actor : List->Actors)
		{
			Visible.Add(Actor);
		}
	}

	for (const TPair<EArchVizSeason, FArchVizActorList>& Pair : SeasonActors)
	{
		for (AActor* Actor : Pair.Value.Actors)
		{
			if (Actor)
			{
				Actor->SetActorHiddenInGame(!Visible.Contains(Actor));
			}
		}
	}
}

void AArchVizEnvironment::ComputeSunPosition(float Latitude, float Longitude, float UtcOffset, int32 InDayOfYear, float Hours, float& OutElevation, float& OutAzimuth)
{
	// NOAA General Solar Position (accurate to well under a degree, plenty for lighting).
	const double G = 2.0 * UE_DOUBLE_PI / 365.0 * (InDayOfYear - 1 + (Hours - 12.0) / 24.0);
	const double EqTimeMinutes = 229.18 * (0.000075 + 0.001868 * FMath::Cos(G) - 0.032077 * FMath::Sin(G)
		- 0.014615 * FMath::Cos(2.0 * G) - 0.040849 * FMath::Sin(2.0 * G));
	const double Declination = 0.006918 - 0.399912 * FMath::Cos(G) + 0.070257 * FMath::Sin(G)
		- 0.006758 * FMath::Cos(2.0 * G) + 0.000907 * FMath::Sin(2.0 * G)
		- 0.002697 * FMath::Cos(3.0 * G) + 0.00148 * FMath::Sin(3.0 * G);

	const double TrueSolarMinutes = Hours * 60.0 + EqTimeMinutes + 4.0 * Longitude - 60.0 * UtcOffset;
	const double HourAngle = FMath::DegreesToRadians(TrueSolarMinutes / 4.0 - 180.0);
	const double Lat = FMath::DegreesToRadians(static_cast<double>(Latitude));

	const double CosZenith = FMath::Clamp(FMath::Sin(Lat) * FMath::Sin(Declination) + FMath::Cos(Lat) * FMath::Cos(Declination) * FMath::Cos(HourAngle), -1.0, 1.0);
	OutElevation = static_cast<float>(90.0 - FMath::RadiansToDegrees(FMath::Acos(CosZenith)));

	// Meeus: azimuth from south, westward positive; +180 gives clockwise from north.
	const double FromSouth = FMath::Atan2(FMath::Sin(HourAngle), FMath::Cos(HourAngle) * FMath::Sin(Lat) - FMath::Tan(Declination) * FMath::Cos(Lat));
	OutAzimuth = static_cast<float>(FMath::Fmod(FMath::RadiansToDegrees(FromSouth) + 540.0, 360.0));
}
