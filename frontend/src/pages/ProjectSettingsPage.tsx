import { DIMENSIONS, GENRES, genreDefaults, type Dimension } from '../lib/gameSystems';
import { useProject } from './ProjectHomePage';
import './ProjectTabs.css';

export default function ProjectSettingsPage() {
  const { project, patchProject } = useProject();

  function pickDimension(dimension: Dimension) {
    void patchProject({ dimension: project.dimension === dimension ? '' : dimension });
  }

  function pickGenre(genre: string) {
    if (project.genre === genre) return;
    // Seed sensible system defaults from the genre, but only if the user hasn't
    // configured systems yet — never clobber existing work.
    const systemsEmpty = !project.systems || Object.keys(project.systems).length === 0;
    void patchProject(systemsEmpty ? { genre, systems: genreDefaults(genre) } : { genre });
  }

  return (
    <div className="ptab pset">
      <p className="ptab__lead">
        Pick a dimension and a genre. These decide which systems and questions make sense for your
        game — choosing a genre also pre-enables a sensible starter set of systems.
      </p>

      <section className="ptab__section">
        <div className="ptab__section-head">
          <h2 className="ptab__section-title">Dimension</h2>
          <span className="ptab__section-value">
            {project.dimension ? project.dimension.toUpperCase() : '—'}
          </span>
        </div>
        <div className="pset__dims">
          {DIMENSIONS.map((d) => (
            <button
              key={d.id}
              type="button"
              className={'pset-card' + (project.dimension === d.id ? ' pset-card--active' : '')}
              onClick={() => pickDimension(d.id)}
            >
              <span className="pset-card__icon">{d.icon}</span>
              <span className="pset-card__body">
                <span className="pset-card__label">{d.label}</span>
                <span className="pset-card__blurb">{d.blurb}</span>
              </span>
              {project.dimension === d.id && <span className="pset-card__check">✓</span>}
            </button>
          ))}
        </div>
      </section>

      <section className="ptab__section">
        <div className="ptab__section-head">
          <h2 className="ptab__section-title">Genre</h2>
          <span className="ptab__section-value">
            {project.genre ? project.genre.toUpperCase() : '—'}
          </span>
        </div>
        <div className="pset__genres">
          {GENRES.map((g) => (
            <button
              key={g.id}
              type="button"
              className={'pset-card' + (project.genre === g.id ? ' pset-card--active' : '')}
              onClick={() => pickGenre(g.id)}
            >
              <span className="pset-card__icon">{g.icon}</span>
              <span className="pset-card__body">
                <span className="pset-card__label">{g.name}</span>
                <span className="pset-card__blurb">{g.blurb}</span>
              </span>
              {project.genre === g.id && <span className="pset-card__check">✓</span>}
            </button>
          ))}
        </div>
      </section>
    </div>
  );
}
