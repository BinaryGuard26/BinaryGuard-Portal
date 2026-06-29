import { useState } from 'react';
import "./styles/portal.css";

type Layer = 'user' | 'service' | 'order';
type Screen = 'welcome' | 'register' | 'login' | 'verify' | 'recover' | 'service' | 'order' | 'success';

const approvedDomains = ['gov.mb.ca', 'clientabc.com', 'cityofx.ca'];
const otp = '248106';
const statuses = ['Submitted','Under Review','More Information Required','Approved','In Progress','Completed','Cancelled','Rejected'];

export default function App() {
  const [layer, setLayer] = useState<Layer>('user');
  const [screen, setScreen] = useState<Screen>('welcome');
  const [email, setEmail] = useState('john.smith@gov.mb.ca');
  const [org, setOrg] = useState('Government of Manitoba');
  const [code, setCode] = useState('248106');
  const [logs, setLogs] = useState<string[]>(['Portal loaded. Layer 2 and Layer 3 are inactive until User Authentication is completed.']);
  const [verified, setVerified] = useState(false);

  const [order, setOrder] = useState({
    requester_email:'john.smith@gov.mb.ca',
    cardholder_name:'',
    cardholder_email:'',
    site_name:'Main Office',
    building_address:'',
    request_type:'New Card',
    access_level:'Standard Access',
    effective_date:'',
    notes:''
  });

  function addLog(message: string) {
    const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    setLogs(current => [`${time} - ${message}`, ...current]);
  }

  function allowed(layerName: Layer) {
    return layer === layerName;
  }

  function go(next: Screen) {
    const nextLayer: Layer = ['welcome','register','login','verify','recover'].includes(next) ? 'user' : next === 'service' ? 'service' : 'order';
    if (!allowed(nextLayer)) {
      if (nextLayer === 'user') alert('User Authentication is inactive. Logout to start again.');
      if (nextLayer === 'service') alert('Service Authorization is inactive until OTP Verification is completed.');
      if (nextLayer === 'order') alert('Access Card Order Portal is inactive until Service Authorization is completed.');
      return;
    }
    setScreen(next);
  }

  function validateEmailAndSendOtp() {
    const domain = email.split('@')[1]?.toLowerCase();
    if (!domain || !approvedDomains.includes(domain)) {
      addLog(`Access denied for unauthorized domain: ${email}`);
      alert('Your organization is not authorized to access this portal. Please contact BinaryGuard.');
      return;
    }
    addLog(`Corporate domain approved: ${domain}. OTP generated and sent.`);
    setScreen('verify');
  }

  function verifyOtp() {
    if (code !== otp) {
      addLog('OTP verification failed.');
      alert('Invalid OTP code.');
      return;
    }
    setVerified(true);
    setLayer('service');
    setScreen('service');
    addLog('OTP verified. Layer 1 inactive. Layer 2 Service Authorization active.');
  }

  function openOrderPortal() {
    setLayer('order');
    setScreen('order');
    setOrder({ ...order, requester_email: email });
    addLog('Service authorized. Layer 2 inactive. Layer 3 Access Card Order Portal active.');
  }

  function submitOrder() {
    const ref = `ACO-${new Date().getFullYear()}-${Math.floor(Math.random()*900000+100000)}`;
    addLog(`Access card order ${ref} submitted. Status: Submitted. Saved with tenant_id and user_id.`);
    addLog('Confirmation email queued for user. Staff notification queued. Audit log created.');
    setScreen('success');
  }

  function logout() {
    setLayer('user');
    setScreen('welcome');
    setVerified(false);
    setCode('248106');
    addLog('Logout completed. Layer 1 active. Layer 2 and Layer 3 inactive.');
  }

  const header = screen === 'service'
    ? ['Layer 2 · Service Authorization','Service Authorization']
    : screen === 'order' || screen === 'success'
      ? ['Layer 3 · Access Card Order Portal','Access Card Order Portal']
      : ['Layer 1 · User Authentication','User Authentication'];

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <span className="brand-mark">BG</span>
          <div><strong>BinaryGuard</strong><small>Secure Client Gateway</small></div>
        </div>

        <div className="secure-chip"><span></span>portal.binaryguard.ca</div>

        <nav className="journey">
          <button className={`journey-step ${layer === 'user' ? 'active' : 'done'}`} onClick={() => go('welcome')}>
            <i>01</i><div><b>User Authentication</b><small>Register, Login, Verify, Recover</small></div>
          </button>
          <button className={`journey-step ${layer === 'service' ? 'active' : layer === 'order' ? 'done' : 'locked'}`} onClick={() => go('service')}>
            <i>02</i><div><b>Service Authorization</b><small>Locked until OTP verification</small></div>
          </button>
          <button className={`journey-step ${layer === 'order' ? 'active' : 'locked'}`} onClick={() => go('order')}>
            <i>03</i><div><b>Access Card Order Portal</b><small>Locked until service authorization</small></div>
          </button>
        </nav>

        <div className="security-card">
          <span className="shield">✓</span>
          <div><strong>Separate admin surface</strong><p>Staff/Admin functions remain isolated at admin.binaryguard.ca.</p></div>
        </div>
      </aside>

      <main>
        <header className="topbar">
          <div><p className="eyebrow">{header[0]}</p><h1>{header[1]}</h1></div>
          <span className={`status ${verified ? 'ok' : ''}`}><i></i>{verified ? 'Verified' : 'Not Verified'}</span>
          <div className="session">
            <span className="avatar">BG</span>
            <div><b>{email}</b><small>{org}</small></div>
            <button className="text-btn" onClick={logout}>Logout</button>
          </div>
        </header>

        <section className={`page ${screen === 'welcome' ? 'active' : ''}`}>
          <div className="hero">
            <div className="hero-icon">🔐</div>
            <div><p className="eyebrow">Welcome</p><h2>BinaryGuard Secure Client Gateway</h2><p>Secure access to authorized client services through user authentication, OTP verification, service authorization, and access card ordering.</p></div>
          </div>
          <section className="card compact">
            <p className="eyebrow">Start here</p>
            <h2>Choose how you want to continue</h2>
            <div className="split-actions">
              <button className="primary" onClick={() => go('register')}>Register</button>
              <button className="secondary" onClick={() => go('login')}>Login</button>
              <button className="secondary" onClick={() => go('verify')}>Verify OTP</button>
              <button className="secondary" onClick={() => go('recover')}>Recover Access</button>
            </div>
          </section>
        </section>

        <section className={`page ${screen === 'register' ? 'active' : ''}`}>
          <div className="hero"><div className="hero-icon">ID</div><div><p className="eyebrow">Layer 1</p><h2>Verify Corporate Identity</h2><p>Register using an approved corporate domain.</p></div></div>
          <section className="card compact">
            <label>Full Name<input defaultValue="John Smith" /></label>
            <label>Corporate Email<input value={email} onChange={e => setEmail(e.target.value)} /></label>
            <label>Organization<input value={org} onChange={e => setOrg(e.target.value)} /></label>
            <button className="primary" onClick={validateEmailAndSendOtp}>Continue <span>→</span></button>
          </section>
        </section>

        <section className={`page ${screen === 'login' ? 'active' : ''}`}>
          <div className="hero"><div className="hero-icon">↪</div><div><p className="eyebrow">Layer 1</p><h2>Corporate Access Login</h2><p>Continue with your corporate email address.</p></div></div>
          <section className="card compact">
            <label>Corporate Email<input value={email} onChange={e => setEmail(e.target.value)} /></label>
            <button className="primary" onClick={validateEmailAndSendOtp}>Continue <span>→</span></button>
          </section>
        </section>

        <section className={`page ${screen === 'recover' ? 'active' : ''}`}>
          <div className="hero"><div className="hero-icon">?</div><div><p className="eyebrow">Recovery</p><h2>Recover Portal Access</h2><p>Request a recovery code for your corporate email.</p></div></div>
          <section className="card compact">
            <label>Corporate Email<input value={email} onChange={e => setEmail(e.target.value)} /></label>
            <button className="primary" onClick={validateEmailAndSendOtp}>Send Recovery Code</button>
          </section>
        </section>

        <section className={`page ${screen === 'verify' ? 'active' : ''}`}>
          <div className="hero"><div className="hero-icon">OTP</div><div><p className="eyebrow">Layer 1.5</p><h2>Verify One-Time Passcode</h2><p>Enter the six-digit OTP sent to your corporate email.</p></div></div>
          <section className="card compact">
            <label>OTP Code<input value={code} onChange={e => setCode(e.target.value)} maxLength={6} /></label>
            <div className="code-meta"><span>Demo code: 248106</span><span>Expires in 5 minutes</span></div>
            <button className="primary" onClick={verifyOtp}>Verify OTP</button>
          </section>
        </section>

        <section className={`page ${screen === 'service' ? 'active' : ''}`}>
          <div className="hero"><div className="hero-icon">✓</div><div><p className="eyebrow">Layer 2</p><h2>Authorized Services</h2><p>Only Access Card Ordering Portal is authorized at this stage.</p></div></div>
          <div className="service-grid">
            <article className="service-card featured">
              <div className="service-top"><span className="service-icon">💳</span><span className="approved">Authorized</span></div>
              <h3>Access Card Ordering Portal</h3>
              <p>Submit and manage access card requests for approved client sites.</p>
              <button className="primary" onClick={openOrderPortal}>Open Access Card Ordering</button>
            </article>
            {['Camera Ordering Portal','Quote Request Portal','Service Request Portal'].map(service => (
              <article className="service-card muted" key={service}>
                <div className="service-top"><span className="service-icon">🔒</span><span className="soon">Coming Soon</span></div>
                <h3>{service}</h3>
                <p>This service is currently unavailable for client users.</p>
              </article>
            ))}
          </div>
        </section>

        <section className={`page ${screen === 'order' ? 'active' : ''}`}>
          <div className="order-heading">
            <div><p className="eyebrow">Layer 3</p><h2>Access Card Order Portal</h2><p>Submission will be saved with tenant_id and user_id. Initial status: Submitted.</p></div>
            <span className="draft">Draft request</span>
          </div>
          <section className="form-section">
            <div className="section-title"><span>01</span><div><h3>Requester and cardholder details</h3><p>Verified email remains read-only.</p></div><span className="readonly-pill">Verified</span></div>
            <div className="form-grid">
              <label>Requester Email<input value={order.requester_email} readOnly /></label>
              <label>Cardholder Name<input value={order.cardholder_name} onChange={e => setOrder({...order, cardholder_name: e.target.value})} /></label>
              <label>Cardholder Email<input value={order.cardholder_email} onChange={e => setOrder({...order, cardholder_email: e.target.value})} /></label>
              <label>Site<select value={order.site_name} onChange={e => setOrder({...order, site_name: e.target.value})}>{['Main Office','Building A','Building B','Remote Site'].map(x => <option key={x}>{x}</option>)}</select></label>
              <label>Building Address<input value={order.building_address} onChange={e => setOrder({...order, building_address: e.target.value})} /></label>
              <label>Request Type<select value={order.request_type} onChange={e => setOrder({...order, request_type: e.target.value})}>{['New Card','Replacement Card','Temporary Card','Cancel Card','Access Change'].map(x => <option key={x}>{x}</option>)}</select></label>
              <label>Access Level<select value={order.access_level} onChange={e => setOrder({...order, access_level: e.target.value})}>{['Standard Access','Office Access','Restricted Area Access','Manager Approval Required'].map(x => <option key={x}>{x}</option>)}</select></label>
              <label>Effective Date<input type="date" value={order.effective_date} onChange={e => setOrder({...order, effective_date: e.target.value})} /></label>
            </div>
          </section>
          <section className="form-section">
            <div className="section-title"><span>02</span><div><h3>Additional notes</h3><p>Add any remarks for BinaryGuard review.</p></div></div>
            <label>Notes<textarea value={order.notes} onChange={e => setOrder({...order, notes: e.target.value})} /></label>
          </section>
          <div className="form-actions">
            <p><span>Workflow:</span> {statuses.join(' → ')}</p>
            <div className="form-action-buttons">
              <button className="primary" onClick={submitOrder}>Submit Access Card Request</button>
              <button className="danger" onClick={logout}>Logout</button>
            </div>
          </div>
        </section>

        <section className={`page ${screen === 'success' ? 'active' : ''}`}>
          <section className="success-card">
            <div className="success-icon">✓</div>
            <p className="eyebrow">Request submitted</p>
            <h2>Access card request submitted</h2>
            <p>Status: <strong>Submitted</strong></p>
            <div className="success-actions">
              <button className="primary" onClick={() => setScreen('order')}>Submit Another Request</button>
              <button className="secondary" onClick={logout}>Logout</button>
            </div>
          </section>
        </section>

        <aside className="client-dashboard">
          <div className="dashboard-heading">
            <div><p className="eyebrow">Process log</p><h2>Session Activity</h2><p>Recent authentication and service authorization activity.</p></div>
            <button className="secondary small" onClick={() => setLogs([])}>Clear</button>
          </div>
          <div className="request-list">
            {logs.map((log, index) => <div className="audit-line" key={`${log}-${index}`}>{index + 1}. {log}</div>)}
          </div>
        </aside>
      </main>
    </div>
  );
}
