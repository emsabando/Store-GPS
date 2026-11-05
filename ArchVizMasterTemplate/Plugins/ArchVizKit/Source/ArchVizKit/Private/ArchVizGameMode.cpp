#include "ArchVizGameMode.h"

#include "ArchVizCameraPawn.h"
#include "ArchVizPlayerController.h"

AArchVizGameMode::AArchVizGameMode()
{
	DefaultPawnClass = AArchVizCameraPawn::StaticClass();
	PlayerControllerClass = AArchVizPlayerController::StaticClass();
}
