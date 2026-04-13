import React from 'react';

const Dashboard = () => {
  return (
    <div>
      <div className="page-header">
        <div className="breadcrumb">Pages / Dashboard</div>
        <h1 className="page-title">Main Dashboard</h1>
      </div>
      <div className="panel" style={{ height: '400px', display:'flex', alignItems:'center', justifyContent:'center', color:'var(--text-secondary)'}}>
        <p>Dashboard Overview</p>
      </div>
    </div>
  );
};

export default Dashboard;
