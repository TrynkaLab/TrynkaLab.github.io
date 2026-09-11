import { HorizontalScroller } from '../HorizontalScroller';
import { SiteFooter } from '../SiteFooter';
import './index.css';

const researchItems = [
  {
    title: 'Single-cell eQTL mapping in dynamic immune states',
    description:
      'We map context-specific genetic effects on gene regulation in resting and stimulated immune cells, including work through Project JAGUAR to study immune gene regulation across Latin American populations and address representation gaps in genomic data.',
  },
  {
    title: 'CRISPR perturbation of immune disease-associated genes',
    description:
      'Pooled and arrayed CRISPR screens in primary immune cells let us define the causal gene functions that underlie immune-mediated diseases.',
  },
  {
    title: 'High-content imaging of cellular phenotypes',
    description:
      'High-throughput imaging quantifies morphological and functional features at the single-cell level, which we integrate with transcriptomic data to connect cell phenotype to gene regulation.',
  },
];

export function HomeLayout() {
  return (
    <>
      <main className="home-layout">
        <HorizontalScroller className="home-layout__scroller">
          <div className="card home-layout__banner-summary">
            <p className="home-layout__banner-area">Immune Genomics Group</p>
            <h1>Trynka Group</h1>
            <p className="home-layout__banner-mission">
              We investigate how genetic variation shapes immune cell function and
              contributes to human disease, connecting genetic associations to mechanisms
              and opportunities for therapeutic discovery.
            </p>
          </div>
        </HorizontalScroller>

        <section className="home-layout__research" aria-labelledby="research-title">
          <h2 id="research-title">Research</h2>

          <div className="home-layout__research-items">
            {researchItems.map((item, index) => {
              const imagePosition = index % 2 === 0 ? 'left' : 'right';

              return (
                <article
                  className={`research-item research-item--image-${imagePosition}`}
                  key={item.title}
                >
                  <div
                    className="card research-item__image"
                    aria-label={`${item.title} image placeholder`}
                  >
                    <span>Image placeholder</span>
                  </div>

                  <div className="research-item__content">
                    <h3>{item.title}</h3>
                    <p>{item.description}</p>
                  </div>
                </article>
              );
            })}
          </div>
        </section>
      </main>

      <SiteFooter />
    </>
  );
}
