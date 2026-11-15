import UnusualActivity from '../components/UnusualActivity';

/** Own page for the unusual-activity scanner (opened from the pulsing button in the top bar). */
const Unusual = () => (
  <div className="editorial-page-container">
    <UnusualActivity limit={10} />
  </div>
);

export default Unusual;
