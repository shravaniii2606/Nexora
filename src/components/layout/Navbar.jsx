import React from 'react';
import { NavLink } from 'react-router-dom';
import { LayoutDashboard, PlusCircle, Bot, BarChart3, TimerReset } from 'lucide-react';

const Navbar = () => {
  const navItems = [
    { path: '/dashboard', label: 'Dashboard', icon: <LayoutDashboard className="nav-icon" /> },
    { path: '/sprints', label: 'Sprints', icon: <TimerReset className="nav-icon" /> },
    { path: '/add', label: 'Add', icon: <PlusCircle className="nav-icon" /> },
    { path: '/ai', label: 'AI', icon: <Bot className="nav-icon" /> },
    { path: '/analytics', label: 'Analytics', icon: <BarChart3 className="nav-icon" /> },
  ];

  return (
    <nav className="sidebar">
      <div className="sidebar-logo">
        <div style={{width: 32, height: 32, background: 'var(--accent-orange)', borderRadius: 8, display: 'flex', alignItems:'center', justifyContent:'center', color:'#fff', fontWeight: 'bold'}} >N</div>
        Nexora
      </div>
      <div className="nav-links">
        {navItems.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
          >
            {item.icon}
            <span>{item.label}</span>
          </NavLink>
        ))}
      </div>
    </nav>
  );
};

export default Navbar;
