# Known issues

## A held pick can keep the old model's effort after a mid-turn model switch

A message typed while a turn runs is judged at once. If its effort is lower than the running turn's, effortless holds
it (`heldPick` in `hooks/register.tsx`) and applies it when the turn ends, so the running task keeps its effort.

`modelIs` re-settles the current pick on a model switch, taking the new model's own answer from `pick.judged`. It does
not touch `heldPick`. So if the model is switched while a pick is held, the held pick lands at turn end with the old
model in its `model` field and the old model's effort.

Rare: it needs a message typed mid-turn, a lower verdict, and a model switch before the turn ends. The next judged
prompt corrects it. Fix when it matters: re-settle `heldPick` in `modelIs` the same way as the pick.

## The band shows the effort in force from the last request, not the app's own /effort

effortless sees the app's effort only in the next request (`turn.step`, comparing with `engineEffort`). The plugin API has
no event for the app's effort picker and no `$.session` field for the current effort, so when the person runs `/effort`
or uses the picker, the band keeps the old level until they send a message. Then it turns Auto off and shows their level.

Not fixable inside the plugin while the API has no such event. Fix when it matters: a host event for the effort change.

## A message typed mid-turn with a lower verdict is not shown in the band until the turn ends

The lower verdict waits in `heldPick` so the running task keeps its effort (see above). The band shows the running
level and nothing about the waiting one, so it can look a turn behind the judge. It applies when the turn ends.

Fix when it matters: show the waiting level in the band's reason line while `heldPick` is set.
