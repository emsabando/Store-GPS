#pragma once

#include "CoreMinimal.h"
#include "GameFramework/SaveGame.h"
#include "ArchVizSaveGame.generated.h"

/** Persists the visitor's favourites ("bookmarks") between sessions. */
UCLASS()
class ARCHVIZKIT_API UArchVizSaveGame : public USaveGame
{
	GENERATED_BODY()

public:
	UPROPERTY()
	TArray<FName> Favorites;
};
