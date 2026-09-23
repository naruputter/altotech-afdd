import React from 'react';

interface EnergyViewProps {
  currentSite: string;
}

export default function EnergyView({ currentSite }: EnergyViewProps) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '16px' }}>
        
        <div className="card-panel" style={{ padding: '20px' }}>
          <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontWeight: '600', textTransform: 'uppercase' }}>Daily Energy Consumption</p>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginTop: '8px' }}>
            <h3 style={{ fontSize: '1.8rem', fontWeight: '800', color: 'var(--text-main)' }}>1,420.8 <span style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>kWh</span></h3>
            <span style={{ fontSize: '0.75rem', color: '#16a34a', fontWeight: '600' }}>
              -4.2% vs baseline
            </span>
          </div>
        </div>

        <div className="card-panel" style={{ padding: '20px' }}>
          <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontWeight: '600', textTransform: 'uppercase' }}>Electricity Cost Estimate</p>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginTop: '8px' }}>
            <h3 style={{ fontSize: '1.8rem', fontWeight: '800', color: 'var(--text-main)' }}>6,393.6 <span style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>THB</span></h3>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>@ 4.5 THB/unit</span>
          </div>
        </div>

        <div className="card-panel" style={{ padding: '20px' }}>
          <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontWeight: '600', textTransform: 'uppercase' }}>FDD Fault Energy Waste</p>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginTop: '8px' }}>
            <h3 style={{ fontSize: '1.8rem', fontWeight: '800', color: '#dc2626' }}>54.5 <span style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>kWh</span></h3>
            <span style={{ fontSize: '0.75rem', color: '#dc2626', fontWeight: '600' }}>
              ~245 THB loss
            </span>
          </div>
        </div>

        <div className="card-panel" style={{ padding: '20px' }}>
          <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontWeight: '600', textTransform: 'uppercase' }}>Carbon Emission Footprint</p>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginTop: '8px' }}>
            <h3 style={{ fontSize: '1.8rem', fontWeight: '800', color: '#0284c7' }}>710.4 <span style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>kgCO2e</span></h3>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Grid factor 0.50 kg/kWh</span>
          </div>
        </div>

      </div>

      <div className="card-panel" style={{ padding: '24px' }}>
        <h3 style={{ fontSize: '1.05rem', fontWeight: '700', marginBottom: '16px' }}>Energy Distribution by Sub-system</h3>
        
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.84rem', marginBottom: '6px' }}>
              <span style={{ fontWeight: '600' }}>HVAC & Cooling (Chillers, AHUs, FCUs)</span>
              <span>852.5 kWh (60%)</span>
            </div>
            <div style={{ height: '8px', background: 'var(--bg-subtle)', borderRadius: '4px', overflow: 'hidden' }}>
              <div style={{ width: '60%', height: '100%', background: '#2563eb' }}></div>
            </div>
          </div>

          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.84rem', marginBottom: '6px' }}>
              <span style={{ fontWeight: '600' }}>Lighting Systems</span>
              <span>284.1 kWh (20%)</span>
            </div>
            <div style={{ height: '8px', background: 'var(--bg-subtle)', borderRadius: '4px', overflow: 'hidden' }}>
              <div style={{ width: '20%', height: '100%', background: '#0284c7' }}></div>
            </div>
          </div>

          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.84rem', marginBottom: '6px' }}>
              <span style={{ fontWeight: '600' }}>Plug Loads & IT Equipment</span>
              <span>213.1 kWh (15%)</span>
            </div>
            <div style={{ height: '8px', background: 'var(--bg-subtle)', borderRadius: '4px', overflow: 'hidden' }}>
              <div style={{ width: '15%', height: '100%', background: '#7c3aed' }}></div>
            </div>
          </div>
        </div>
      </div>

    </div>
  );
}
