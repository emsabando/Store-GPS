#include "ArchVizBlueprintLibrary.h"

#include "ArchVizProjectAsset.h"
#include "ArchVizSettings.h"
#include "Engine/Engine.h"
#include "GameFramework/GameUserSettings.h"
#include "Kismet/KismetInternationalizationLibrary.h"
#include "UnrealClient.h"

#define LOCTEXT_NAMESPACE "ArchVizKit"

void UArchVizBlueprintLibrary::ApplyQualityPreset(EArchVizQuality Quality)
{
	UGameUserSettings* Settings = GEngine ? GEngine->GetGameUserSettings() : nullptr;
	if (!Settings)
	{
		return;
	}

	int32 Level = 3;
	float ScreenPercentage = 100.f;
	switch (Quality)
	{
	case EArchVizQuality::Performance: Level = 1; ScreenPercentage = 67.f; break;
	case EArchVizQuality::Balanced:    Level = 2; ScreenPercentage = 85.f; break;
	case EArchVizQuality::High:        Level = 3; ScreenPercentage = 100.f; break;
	case EArchVizQuality::Cinematic:   Level = 4; ScreenPercentage = 100.f; break;
	}

	Settings->SetOverallScalabilityLevel(Level);
	Settings->SetResolutionScaleValueEx(ScreenPercentage);
	Settings->ApplySettings(false); // also saves to GameUserSettings.ini
}

EArchVizQuality UArchVizBlueprintLibrary::GetQualityPreset()
{
	const UGameUserSettings* Settings = GEngine ? GEngine->GetGameUserSettings() : nullptr;
	switch (Settings ? Settings->GetOverallScalabilityLevel() : 3)
	{
	case 0:
	case 1:  return EArchVizQuality::Performance;
	case 2:  return EArchVizQuality::Balanced;
	case 4:  return EArchVizQuality::Cinematic;
	default: return EArchVizQuality::High; // 3, or -1 for custom settings
	}
}

bool UArchVizBlueprintLibrary::SetLanguage(const FString& Culture)
{
	return !Culture.IsEmpty() && UKismetInternationalizationLibrary::SetCurrentCulture(Culture, true);
}

void UArchVizBlueprintLibrary::TakeScreenshot(bool bWithUI)
{
	FScreenshotRequest::RequestScreenshot(bWithUI);
}

FText UArchVizBlueprintLibrary::FormatPrice(int64 Price, const FString& CurrencyCode)
{
	FNumberFormattingOptions Options;
	Options.UseGrouping = true;
	Options.MaximumFractionalDigits = 0;
	return FText::Format(LOCTEXT("PriceFormat", "{0} {1}"), FText::AsNumber(Price, &Options), FText::FromString(CurrencyCode));
}

FText UArchVizBlueprintLibrary::FormatArea(float SquareMetres, int32 Decimals)
{
	FNumberFormattingOptions Options;
	Options.UseGrouping = true;
	Options.MinimumFractionalDigits = FMath::Clamp(Decimals, 0, 3);
	Options.MaximumFractionalDigits = FMath::Clamp(Decimals, 0, 3);
	return FText::Format(LOCTEXT("AreaFormat", "{0} m\u00B2"), FText::AsNumber(SquareMetres, &Options));
}

FText UArchVizBlueprintLibrary::FormatTimeOfDay(float Hours)
{
	const int32 TotalMinutes = FMath::RoundToInt(FMath::Fmod(FMath::Max(Hours, 0.f), 24.f) * 60.f) % (24 * 60);
	return FText::FromString(FString::Printf(TEXT("%02d:%02d"), TotalMinutes / 60, TotalMinutes % 60));
}

FText UArchVizBlueprintLibrary::GetStatusText(EArchVizUnitStatus Status)
{
	switch (Status)
	{
	case EArchVizUnitStatus::Available:  return LOCTEXT("StatusAvailable", "Available");
	case EArchVizUnitStatus::Reserved:   return LOCTEXT("StatusReserved", "Reserved");
	case EArchVizUnitStatus::Sold:       return LOCTEXT("StatusSold", "Sold");
	default:                             return LOCTEXT("StatusNotForSale", "Not for sale");
	}
}

FLinearColor UArchVizBlueprintLibrary::GetStatusColor(EArchVizUnitStatus Status)
{
	const UArchVizProjectAsset* Project = GetProjectAsset();
	return Project ? Project->Theme.GetStatusColor(Status) : FArchVizTheme().GetStatusColor(Status);
}

FText UArchVizBlueprintLibrary::GetBuildingName(FName Building)
{
	if (const UArchVizProjectAsset* Project = GetProjectAsset())
	{
		if (const FText* Name = Project->BuildingNames.Find(Building))
		{
			return *Name;
		}
	}
	return FText::FromName(Building);
}

UArchVizProjectAsset* UArchVizBlueprintLibrary::GetProjectAsset()
{
	const UArchVizSettings* Settings = UArchVizSettings::Get();
	return Settings ? Settings->ProjectAsset.LoadSynchronous() : nullptr;
}

#undef LOCTEXT_NAMESPACE
