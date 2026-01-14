(function () {
  const currentScript = document.currentScript;
  if (!currentScript) {
    console.warn('[InnSight Widget] Unable to locate script tag.');
    return;
  }

  const dataset = currentScript.dataset || {};
  const tenantSlug = dataset.tenant;
  const targetId = dataset.target || 'innsight-portal-widget';
  const portalOrigin = (dataset.portal || new URL(currentScript.src, window.location.href).origin).replace(/\/$/, '');
  const apiBase = (dataset.api || `${portalOrigin}/api/public/portal`).replace(/\/$/, '');
  const widgetMode = dataset.mode || 'modal';

  if (!tenantSlug) {
    console.warn('[InnSight Widget] data-tenant attribute is required');
    return;
  }

  const targetEl = document.getElementById(targetId);
  if (!targetEl) {
    console.warn(`[InnSight Widget] Target element #${targetId} not found.`);
    return;
  }

  const state = {
    primaryColor: '#0f172a',
    accentColor: '#7c3aed',
    propertyName: 'Your stay',
  };

  const applyCard = () => {
    targetEl.innerHTML = '';
    targetEl.style.fontFamily = 'Inter, "Segoe UI", system-ui, -apple-system, BlinkMacSystemFont, sans-serif';

    const card = document.createElement('div');
    card.style.border = '1px solid rgba(15,23,42,0.1)';
    card.style.borderRadius = '18px';
    card.style.padding = '20px';
    card.style.background = '#fff';
    card.style.boxShadow = '0 25px 55px rgba(15, 23, 42, 0.08)';
    card.style.display = 'flex';
    card.style.flexDirection = 'column';
    card.style.gap = '12px';

    const heading = document.createElement('div');
    heading.style.display = 'flex';
    heading.style.flexDirection = 'column';
    heading.style.gap = '4px';

    const label = document.createElement('p');
    label.textContent = state.propertyName.toUpperCase();
    label.style.margin = '0';
    label.style.color = 'rgba(15,23,42,0.65)';
    label.style.fontSize = '0.75rem';
    label.style.letterSpacing = '0.12em';

    const title = document.createElement('h3');
    title.textContent = 'Book your stay';
    title.style.margin = '0';
    title.style.fontSize = '1.35rem';
    title.style.color = state.primaryColor;

    heading.appendChild(label);
    heading.appendChild(title);
    card.appendChild(heading);

    const subtext = document.createElement('p');
    subtext.textContent = 'Check availability, pay securely, and get instant confirmation.';
    subtext.style.margin = '0';
    subtext.style.color = 'rgba(15,23,42,0.65)';
    subtext.style.fontSize = '0.95rem';
    card.appendChild(subtext);

    const button = document.createElement('button');
    button.textContent = 'Launch booking';
    button.style.border = 'none';
    button.style.borderRadius = '999px';
    button.style.padding = '0.85rem 1.75rem';
    button.style.fontSize = '1rem';
    button.style.fontWeight = '600';
    button.style.cursor = 'pointer';
    button.style.background = `linear-gradient(135deg, ${state.primaryColor}, ${state.accentColor})`;
    button.style.color = '#fff';
    button.style.transition = 'opacity 0.2s ease';
    button.onmouseenter = () => (button.style.opacity = '0.85');
    button.onmouseleave = () => (button.style.opacity = '1');

    button.onclick = () => {
      if (widgetMode === 'modal') {
        openModal();
      } else {
        window.open(`${portalOrigin}/portal/${tenantSlug}/checkout`, '_blank', 'noopener');
      }
    };

    card.appendChild(button);
    targetEl.appendChild(card);
  };

  const openModal = () => {
    const existing = document.querySelector('.innsight-widget-overlay');
    if (existing) existing.remove();

    const overlay = document.createElement('div');
    overlay.className = 'innsight-widget-overlay';
    overlay.style.position = 'fixed';
    overlay.style.top = '0';
    overlay.style.left = '0';
    overlay.style.width = '100vw';
    overlay.style.height = '100vh';
    overlay.style.background = 'rgba(15,23,42,0.75)';
    overlay.style.zIndex = '99999';
    overlay.style.display = 'flex';
    overlay.style.alignItems = 'center';
    overlay.style.justifyContent = 'center';
    overlay.style.padding = '2vw';

    const modal = document.createElement('div');
    modal.style.width = 'min(1024px, 100%)';
    modal.style.height = 'min(90vh, 760px)';
    modal.style.background = '#fff';
    modal.style.borderRadius = '24px';
    modal.style.overflow = 'hidden';
    modal.style.position = 'relative';

    const closeBtn = document.createElement('button');
    closeBtn.textContent = '×';
    closeBtn.setAttribute('aria-label', 'Close booking widget');
    closeBtn.style.position = 'absolute';
    closeBtn.style.top = '16px';
    closeBtn.style.right = '16px';
    closeBtn.style.border = 'none';
    closeBtn.style.background = 'rgba(15,23,42,0.6)';
    closeBtn.style.color = '#fff';
    closeBtn.style.width = '36px';
    closeBtn.style.height = '36px';
    closeBtn.style.borderRadius = '50%';
    closeBtn.style.cursor = 'pointer';
    closeBtn.style.fontSize = '1.25rem';
    closeBtn.onclick = () => overlay.remove();

    const iframe = document.createElement('iframe');
    const embedUrl = `${portalOrigin}/portal/${tenantSlug}/checkout?embed=1`;
    iframe.src = embedUrl;
    iframe.style.width = '100%';
    iframe.style.height = '100%';
    iframe.style.border = 'none';
    iframe.referrerPolicy = 'no-referrer-when-downgrade';

    modal.appendChild(iframe);
    modal.appendChild(closeBtn);
    overlay.appendChild(modal);
    document.body.appendChild(overlay);
  };

  const hydrateBranding = async () => {
    try {
      const response = await fetch(`${apiBase}/${tenantSlug}/summary`, {
        credentials: 'omit',
      });
      if (!response.ok) {
        throw new Error('Failed to load branding');
      }
      const payload = await response.json();
      const branding = payload?.data?.branding || {};
      const propertyName = payload?.data?.name;
      if (branding.primaryColor) state.primaryColor = branding.primaryColor;
      if (branding.accentColor) state.accentColor = branding.accentColor;
      if (propertyName) state.propertyName = propertyName;
    } catch (error) {
      console.warn('[InnSight Widget] Branding fetch failed:', error);
    } finally {
      applyCard();
    }
  };

  hydrateBranding();
})();
