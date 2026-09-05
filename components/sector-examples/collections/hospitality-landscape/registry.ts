import type { ComponentType } from "react";
import { EmberOastExample } from "./ember-oast";
import { LarderRoomExample } from "./larder-room";
import { SundayTableExample } from "./sunday-table";
import { GatherHouseExample } from "./gather-house";
import { StillgroundExample } from "./stillground";
import { RootFormExample } from "./root-form";
import { FieldnoteStudioExample } from "./fieldnote-studio";
import { OpenGroundExample } from "./open-ground";
export const hospitalityLandscapeRegistry: Record<string, ComponentType> = {
  "ember-oast": EmberOastExample,
  "larder-room": LarderRoomExample,
  "sunday-table": SundayTableExample,
  "gather-house": GatherHouseExample,
  stillground: StillgroundExample,
  "root-form": RootFormExample,
  "fieldnote-studio": FieldnoteStudioExample,
  "open-ground": OpenGroundExample,
};
