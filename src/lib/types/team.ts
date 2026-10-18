export enum Team {
  ALLY = 1,
  ENEMY = 2,
}

export const teamLabelKey = (team: Team): string => (team === Team.ALLY ? 'app.ally' : 'app.enemy')
