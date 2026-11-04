# Known issues

## A held pick can keep the old model's effort after a mid-turn model switch

A message typed while a turn runs is judged at once. If its effort is lower than the running turn's, effortless holds
it (`heldPick` in `hooks/register.tsx`) and applies it when the turn ends, so the running task keeps its effort.

`modelIs` re-settles the current pick on a model switch, taking the new model's own answer from `pick.judged`. It does
not touch `heldPick`. So if the model is switched while a pick is held, the held pick lands at turn end with the old
model in its `model` field and the old model's effort.

Rare: it needs a message typed mid-turn, a lower verdict, and a model switch before the turn ends. The next judged
prompt corrects it. Fix when it matters: re-settle `heldPick` in `modelIs` the same way as the pick.
