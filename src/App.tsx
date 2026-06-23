import { useState } from 'react';
import './styles/portal.css';

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

  const [order, setOrder] = useState({ requester_email:'john.smith@gov.mb.ca', cardholder_name:'', cardholder_email:'', site_name:'Main Office', building_address:'', request_type:'New Card', access_level:'Standard Access', effective_date:'', notes:'' });

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

  const header = screen === 'service' ? ['Layer 2 · Service Authorization','Service Authorization'] : screen === 'order' || screen === 'success' ? ['Layer 3 · Access Card Order Portal','Access Card Order Portal'] : ['Layer 1 · User Authentication','User Authentication'];

  return <main className="portal-shell">
    <aside className="portal-sidebar">
      <div className="brand-badge">BG</div>
      <h1>BinaryGuard Secure Client Gateway</h1>
      <p>Secure access to authorized client services through user authentication, OTP verification, service authorization, and access card ordering.</p>
      <nav className="layer-nav">
        <button className={`layer-step ${layer==='user'?'active':'locked'}`} onClick={()=>go('welcome')}><span>01</span><div><strong>User Authentication</strong><small>Register, Login, Verify, Recover</small></div></button>
        <button className={`layer-step ${layer==='service'?'active':'locked'}`} onClick={()=>go('service')}><span>02</span><div><strong>Service Authorization</strong><small>Locked until OTP verification</small></div></button>
        <button className={`layer-step ${layer==='order'?'active':'locked'}`} onClick={()=>go('order')}><span>03</span><div><strong>Access Card Order Portal</strong><small>Locked until service authorization</small></div></button>
      </nav>
      <div className="admin-link-card"><strong>Staff/Admin Portal</strong><p>Admin functions stay separated.</p><a href="https://admin.binaryguard.ca" target="_blank" rel="noreferrer">Open admin.binaryguard.ca</a></div>
    </aside>

    <section className="portal-main">
      <header className="portal-header"><div><p className="eyebrow">{header[0]}</p><h2>{header[1]}</h2></div><span className={`status-pill ${verified?'ok':''}`}>{verified?'Verified':'Not Verified'}</span></header>

      {screen === 'welcome' && <section className="card"><p className="eyebrow">Welcome</p><h3>BinaryGuard Secure Client Gateway</h3><p>Choose how you want to continue.</p><div className="option-grid"><button onClick={()=>go('register')}>Register<small>Verify corporate identity</small></button><button onClick={()=>go('login')}>Login<small>Corporate access login</small></button><button onClick={()=>go('verify')}>Verify OTP<small>One-time passcode</small></button><button onClick={()=>go('recover')}>Recover Access<small>Request recovery code</small></button></div></section>}

      {screen === 'register' && <section className="card"><h3>Verify Corporate Identity</h3><div className="form-grid"><label>Full Name<input defaultValue="John Smith" /></label><label>Corporate Email<input value={email} onChange={e=>setEmail(e.target.value)} /></label><label>Organization<input value={org} onChange={e=>setOrg(e.target.value)} /></label></div><button className="primary" onClick={validateEmailAndSendOtp}>Continue</button></section>}
      {screen === 'login' && <section className="card"><h3>Corporate Access Login</h3><label>Corporate Email<input value={email} onChange={e=>setEmail(e.target.value)} /></label><button className="primary" onClick={validateEmailAndSendOtp}>Continue</button></section>}
      {screen === 'recover' && <section className="card"><h3>Recover Portal Access</h3><label>Corporate Email<input value={email} onChange={e=>setEmail(e.target.value)} /></label><button className="primary" onClick={validateEmailAndSendOtp}>Send Recovery Code</button></section>}
      {screen === 'verify' && <section className="card"><h3>Verify One-Time Passcode</h3><p>Demo code: <strong>248106</strong></p><label>OTP Code<input value={code} onChange={e=>setCode(e.target.value)} maxLength={6}/></label><button className="primary" onClick={verifyOtp}>Verify OTP</button></section>}

      {screen === 'service' && <section className="card"><h3>Authorized Services</h3><p>Only Access Card Ordering Portal is authorized at this stage.</p><div className="service-grid"><article className="service-card enabled"><span>Authorized</span><h4>Access Card Ordering Portal</h4><p>Submit access card requests.</p><button className="primary" onClick={openOrderPortal}>Open Access Card Ordering</button></article>{['Camera Ordering Portal','Quote Request Portal','Service Request Portal'].map(s=><article className="service-card locked-card" key={s}><span>Coming Soon</span><h4>{s}</h4><p>This service is currently unavailable.</p></article>)}</div></section>}

      {screen === 'order' && <section className="card"><h3>Access Card Order Portal</h3><p>Submission will be saved with tenant_id and user_id. Initial status: Submitted.</p><div className="form-grid"><label>Requester Email<input value={order.requester_email} readOnly /></label><label>Cardholder Name<input value={order.cardholder_name} onChange={e=>setOrder({...order,cardholder_name:e.target.value})}/></label><label>Cardholder Email<input value={order.cardholder_email} onChange={e=>setOrder({...order,cardholder_email:e.target.value})}/></label><label>Site<select value={order.site_name} onChange={e=>setOrder({...order,site_name:e.target.value})}>{['Main Office','Building A','Building B','Remote Site'].map(x=><option key={x}>{x}</option>)}</select></label><label>Building Address<input value={order.building_address} onChange={e=>setOrder({...order,building_address:e.target.value})}/></label><label>Request Type<select value={order.request_type} onChange={e=>setOrder({...order,request_type:e.target.value})}>{['New Card','Replacement Card','Temporary Card','Cancel Card','Access Change'].map(x=><option key={x}>{x}</option>)}</select></label><label>Access Level<select value={order.access_level} onChange={e=>setOrder({...order,access_level:e.target.value})}>{['Standard Access','Office Access','Restricted Area Access','Manager Approval Required'].map(x=><option key={x}>{x}</option>)}</select></label><label>Effective Date<input type="date" value={order.effective_date} onChange={e=>setOrder({...order,effective_date:e.target.value})}/></label></div><label className="full-width">Notes<textarea value={order.notes} onChange={e=>setOrder({...order,notes:e.target.value})}/></label><div className="button-row"><button className="primary" onClick={submitOrder}>Submit Access Card Request</button><button className="danger" onClick={logout}>Logout</button></div><div className="workflow-statuses">{statuses.map(s=><span key={s}>{s}</span>)}</div></section>}

      {screen === 'success' && <section className="card success-card"><h3>Request Submitted</h3><p>Status: <strong>Submitted</strong></p><button className="primary" onClick={()=>setScreen('order')}>Submit Another Request</button><button className="danger" onClick={logout}>Logout</button></section>}

      <aside className="process-log"><div className="process-log-header"><strong>Process log</strong><button onClick={()=>setLogs([])}>Clear</button></div><ol>{logs.map((l,i)=><li key={i}>{l}</li>)}</ol></aside>
    </section>
  </main>;
}
