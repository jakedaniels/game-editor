import type { ArchitectState } from '../../lib/gameSystems';
import HealthSim from './HealthSim';
import MovementSim from './MovementSim';
import StaminaSim from './StaminaSim';
import MagicSim from './MagicSim';
import InventorySim from './InventorySim';
import CombatSim from './CombatSim';
import DialogueSketch from './DialogueSketch';

/**
 * Dispatcher: renders the active system's vignette. `setValue` is the page's own
 * answer-update function, so embedded sliders write the same working copy as the form.
 */
export default function SystemSim({
  id,
  state,
  setValue,
}: {
  id: string;
  state: ArchitectState;
  setValue: (key: string, value: string | string[] | number) => void;
}) {
  const values = state[id]?.values ?? {};
  switch (id) {
    case 'health':
      return <HealthSim values={values} setValue={setValue} />;
    case 'movement':
      return <MovementSim values={values} setValue={setValue} />;
    case 'stamina':
      return <StaminaSim values={values} setValue={setValue} />;
    case 'magic':
      return <MagicSim values={values} />;
    case 'inventory':
      return <InventorySim values={values} setValue={setValue} />;
    case 'combat':
      return <CombatSim values={values} healthValues={state.health?.enabled ? state.health.values : undefined} />;
    case 'dialogue':
      return <DialogueSketch values={values} />;
    default:
      return null;
  }
}
