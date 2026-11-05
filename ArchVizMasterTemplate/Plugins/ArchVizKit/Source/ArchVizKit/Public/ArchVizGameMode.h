#pragma once

#include "CoreMinimal.h"
#include "GameFramework/GameModeBase.h"
#include "ArchVizGameMode.generated.h"

/**
 * Orbit camera + mouse/touch controller out of the box. Set it as the default GameMode
 * (Project Settings > Maps & Modes) or as a level's GameMode Override; subclass in
 * Blueprint to swap the pawn or controller.
 */
UCLASS()
class ARCHVIZKIT_API AArchVizGameMode : public AGameModeBase
{
	GENERATED_BODY()

public:
	AArchVizGameMode();
};
