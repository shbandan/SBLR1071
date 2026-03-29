import React, { useEffect, useRef, useState } from 'react';
import { FiChevronDown, FiLayers, FiMoon, FiShield, FiSun, FiZap } from 'react-icons/fi';

type AppTheme = 'light' | 'dark';

const THEME_STORAGE_KEY = 'sblr1071-theme';

const ApplicationHeader: React.FC = () => {
  const [expanded, setExpanded] = useState(false);
  const [theme, setTheme] = useState<AppTheme>(() => {
    if (typeof window === 'undefined') {
      return 'light';
    }

    const saved = window.localStorage.getItem(THEME_STORAGE_KEY);
    return saved === 'dark' ? 'dark' : 'light';
  });
  const rootRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!expanded) {
      return;
    }

    const handleDocumentMouseDown = (event: MouseEvent) => {
      const target = event.target as Node;
      if (rootRef.current && !rootRef.current.contains(target)) {
        setExpanded(false);
      }
    };

    document.addEventListener('mousedown', handleDocumentMouseDown);
    return () => {
      document.removeEventListener('mousedown', handleDocumentMouseDown);
    };
  }, [expanded]);

  useEffect(() => {
    document.body.classList.toggle('theme-dark', theme === 'dark');
    window.localStorage.setItem(THEME_STORAGE_KEY, theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme((current) => (current === 'light' ? 'dark' : 'light'));
  };

  return (
    <div
      ref={rootRef}
      className={`application-header ${expanded ? 'application-header-expanded' : ''}`}
      onMouseEnter={() => setExpanded(true)}
      aria-label="Application Header"
    >
      <div className="application-header-trigger">
        <span className="application-header-title">Platform Administration</span>
        <div className="application-header-actions">
          <button
            type="button"
            className="application-theme-toggle"
            onClick={toggleTheme}
            title={theme === 'light' ? 'Switch to dark mode' : 'Switch to light mode'}
            aria-label={theme === 'light' ? 'Switch to dark mode' : 'Switch to light mode'}
          >
            {theme === 'light' ? <FiMoon size={13} /> : <FiSun size={13} />}
            <span>{theme === 'light' ? 'Dark' : 'Light'}</span>
          </button>
          <FiChevronDown className="application-header-chevron" size={14} />
        </div>
      </div>

      {expanded && (
        <div className="application-header-panel">
          <div className="application-header-item">
            <FiLayers size={14} />
            <span>CFPB 1071 Data Collection Workspace</span>
          </div>
          <div className="application-header-item">
            <FiShield size={14} />
            <span>Compliance Mode: Enabled</span>
          </div>
          <div className="application-header-item">
            <FiZap size={14} />
            <span>Hover to expand, click outside to retract</span>
          </div>
        </div>
      )}
    </div>
  );
};

export default ApplicationHeader;
