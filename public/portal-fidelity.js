(() => {
  if (!document.querySelector('link[href="/portal-fidelity-extra.css"]')) {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = '/portal-fidelity-extra.css';
    document.head.appendChild(link);
  }

  const shell = document.querySelector('.portal-shell');
  const sampleData = window.PORTAL_DEMO_DATA?.SAMPLE_LEADS || [];
  const langMessages = window.PORTAL_DEMO_DATA?.LANG_MESSAGES || {};
  if (!shell) return;

  const search = document.getElementById('portalInboxSearch');
  const channel = document.getElementById('portalInboxChannel');
  const owner = document.getElementById('portalInboxOwner');
  const liveCard = document.getElementById('liveConversationCard');
  const sampleList = document.getElementById('sampleConversationList');
  const samplePane = document.getElementById('sampleConversationPane');
  const sampleLeadPanel = document.getElementById('sampleLeadPanel');
  const scrim = document.getElementById('portalDetailsScrim');
  const pipelineBoard = document.getElementById('pipelineBoard');
  const pipelineSearch = document.getElementById('pipelineSearch');
  let status = 'all';
  let specialPipelineFilter = null;
  let suppressStandardPipelineReset = false;

  const CHANNEL_BRANDS = {
    whatsapp: {
      label: 'WhatsApp',
      path: 'M12.04 2C6.58 2 2.13 6.45 2.13 11.91c0 1.75.46 3.45 1.32 4.95L2 22l5.29-1.39a9.9 9.9 0 0 0 4.75 1.21h.01c5.46 0 9.9-4.45 9.9-9.91C21.96 6.45 17.5 2 12.04 2zm5.8 14.03c-.24.68-1.4 1.3-1.93 1.38-.5.08-1.12.11-1.8-.11a13.6 13.6 0 0 1-1.85-.68c-2.6-1.13-4.3-3.75-4.44-3.93-.13-.18-1.06-1.41-1.06-2.7 0-1.28.67-1.9.91-2.16.24-.26.52-.33.7-.33.17 0 .35 0 .5.01.16.01.38-.06.59.45.24.58.81 2 .88 2.14.07.14.12.31.02.5-.09.18-.14.29-.28.45-.14.16-.29.35-.42.47-.14.13-.28.28-.12.55.16.27.71 1.17 1.52 1.9 1.05.94 1.93 1.23 2.2 1.37.27.14.43.12.59-.07.16-.19.68-.79.86-1.06.18-.27.36-.22.6-.13.24.09 1.55.73 1.82.87.27.13.44.2.51.31.07.11.07.63-.17 1.31z',
    },
    instagram: {
      label: 'Instagram',
      path: 'M12 2.16c3.2 0 3.58.01 4.85.07 1.17.05 1.8.24 2.23.41.55.21.95.47 1.37.89.42.42.68.82.89 1.37.17.42.36 1.06.41 2.23.06 1.27.07 1.65.07 4.85s-.01 3.58-.07 4.85c-.05 1.17-.24 1.8-.41 2.23-.21.55-.47.95-.89 1.37-.42.42-.82.68-1.37.89-.42.17-1.06.36-2.23.41-1.27.06-1.65.07-4.85.07s-3.58-.01-4.85-.07c-1.17-.05-1.8-.24-2.23-.41a3.7 3.7 0 0 1-1.37-.89 3.7 3.7 0 0 1-.89-1.37c-.17-.42-.36-1.06-.41-2.23C2.17 15.58 2.16 15.2 2.16 12s.01-3.58.07-4.85c.05-1.17.24-1.8.41-2.23.21-.55.47-.95.89-1.37.42-.42.82-.68 1.37-.89.42-.17 1.06-.36 2.23-.41C8.42 2.17 8.8 2.16 12 2.16zm0 3.5a6.34 6.34 0 1 0 0 12.68 6.34 6.34 0 0 0 0-12.68zm0 10.46a4.12 4.12 0 1 1 0-8.24 4.12 4.12 0 0 1 0 8.24zm6.6-10.7a1.48 1.48 0 1 1-2.97 0 1.48 1.48 0 0 1 2.97 0z',
    },
    facebook: {
      label: 'Facebook',
      path: 'M22 12.06C22 6.5 17.52 2 12 2S2 6.5 2 12.06c0 5.02 3.66 9.18 8.44 9.94v-7.03H7.9v-2.91h2.54V9.85c0-2.51 1.49-3.9 3.77-3.9 1.09 0 2.24.2 2.24.2v2.46h-1.26c-1.24 0-1.63.77-1.63 1.56v1.89h2.78l-.44 2.91h-2.34V22c4.78-.76 8.44-4.92 8.44-9.94z',
    },
  };

  const PIPELINE_SPECIAL = {
    unassigned: {
      label: 'Unassigned',
      matches: (lead) => lead?.owner === 'Unassigned',
    },
    noReply: {
      label: 'No reply',
      matches: (lead) => lead?.messages?.at(-1)?.[0] === 'customer',
    },
    reschedule: {
      label: 'Reschedule',
      matches: (lead) => lead?.id === 'sample-farah',
    },
    cancelled: {
      label: 'Cancelled',
      matches: (lead) => lead?.id === 'sample-aina',
    },
    overdue: {
      label: 'Follow-up overdue',
      matches: (lead) => ['sample-michelle', 'sample-jiaen'].includes(lead?.id),
    },
  };

  function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>'"]/g, (char) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;',
    }[char]));
  }

  function formatMoney(value) {
    return new Intl.NumberFormat('en-MY', {
      style: 'currency', currency: 'MYR', maximumFractionDigits: 0,
    }).format(value || 0);
  }

  function closeDetails() {
    shell.classList.remove('details-open');
    scrim?.classList.add('hidden');
  }

  function openDetails() {
    shell.classList.add('details-open');
    scrim?.classList.remove('hidden');
  }

  function normalizeBookingCopy() {
    const tourStatus = document.getElementById('tourStatus');
    if (tourStatus?.textContent?.startsWith('Hot lead detected')) {
      tourStatus.textContent = 'Booking intent detected — open Clinic Dashboard';
    }
    const toast = document.getElementById('toast');
    if (toast?.textContent?.startsWith('Hot lead detected.')) {
      toast.textContent = toast.textContent.replace('Hot lead detected.', 'Booking intent detected.');
    }
  }

  function brandBadge(channelName) {
    const key = CHANNEL_BRANDS[channelName] ? channelName : 'whatsapp';
    const brand = CHANNEL_BRANDS[key];
    const badge = document.createElement('span');
    badge.className = `channel-brand-badge channel-brand-${key}`;
    badge.title = brand.label;
    badge.setAttribute('aria-label', brand.label);
    badge.innerHTML = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="${brand.path}"></path></svg>`;
    return badge;
  }

  function decorateAvatar(element, channelName) {
    if (!element) return;
    const key = CHANNEL_BRANDS[channelName] ? channelName : 'whatsapp';
    const existing = element.querySelector('.channel-brand-badge');
    if (existing?.classList.contains(`channel-brand-${key}`)) return;
    existing?.remove();
    element.appendChild(brandBadge(key));
  }

  function channelFromLive() {
    const avatar = document.getElementById('dashboardChannelAvatar');
    if (avatar?.classList.contains('instagram-icon')) return 'instagram';
    if (avatar?.classList.contains('facebook-icon')) return 'facebook';
    const label = document.getElementById('conversationChannelTag')?.textContent?.toLowerCase() || '';
    if (label.includes('instagram')) return 'instagram';
    if (label.includes('messenger') || label.includes('facebook')) return 'facebook';
    return 'whatsapp';
  }

  function decorateChannelBadges() {
    decorateAvatar(document.getElementById('dashboardChannelAvatar'), channelFromLive());

    sampleList?.querySelectorAll('[data-sample-id]').forEach((card) => {
      const lead = sampleData.find((item) => item.id === card.dataset.sampleId);
      decorateAvatar(card.querySelector('.conversation-avatar'), lead?.channel);
    });

    const activeSampleId = document.querySelector('.sample-conversation-card.active')?.dataset.sampleId;
    const activeSample = sampleData.find((item) => item.id === activeSampleId);
    decorateAvatar(samplePane?.querySelector('.sample-avatar'), activeSample?.channel);

    pipelineBoard?.querySelectorAll('[data-pipeline-lead]').forEach((card) => {
      const id = card.dataset.pipelineLead;
      const lead = sampleData.find((item) => item.id === id);
      decorateAvatar(card.querySelector('.mini-avatar'), id === 'live' ? channelFromLive() : lead?.channel);
    });
  }

  document.addEventListener('click', (event) => {
    if (event.target.closest('[data-lead-details]')) openDetails();
    if (event.target.closest('[data-close-details]')) closeDetails();

    const conversation = event.target.closest('.portal-conversation-card');
    if (conversation && window.matchMedia('(max-width: 767px)').matches) {
      shell.classList.add('thread-open');
    }

    const pipelineLead = event.target.closest('[data-pipeline-lead]');
    if (pipelineLead && window.matchMedia('(max-width: 767px)').matches) {
      setTimeout(() => shell.classList.add('thread-open'), 0);
    }

    if (event.target.closest('[data-portal-page]')) {
      shell.classList.remove('thread-open');
      closeDetails();
    }
  });

  document.getElementById('dashboardTab')?.addEventListener('click', () => {
    shell.classList.remove('thread-open');
    closeDetails();
  });
  document.getElementById('newDemoButton')?.addEventListener('click', () => {
    shell.classList.remove('thread-open');
    closeDetails();
  });

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') closeDetails();
  });

  function addMobileBack(header) {
    if (!header || header.querySelector('.portal-mobile-back')) return;
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'portal-mobile-back';
    button.setAttribute('aria-label', 'Back to conversations');
    button.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m15 18-6-6 6-6" stroke-linecap="round" stroke-linejoin="round"/></svg>';
    button.addEventListener('click', () => shell.classList.remove('thread-open'));
    header.prepend(button);
  }

  function addSampleDetailsButton() {
    const header = samplePane?.querySelector('.sample-thread-header');
    if (!header) return;
    addMobileBack(header);
    if (!header.querySelector('[data-lead-details]')) {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'portal-details-button sample-details-button';
      button.dataset.leadDetails = '';
      button.textContent = 'Lead details';
      header.appendChild(button);
    }
    if (sampleLeadPanel && !sampleLeadPanel.querySelector('.portal-details-heading')) {
      const activeId = document.querySelector('.sample-conversation-card.active')?.dataset.sampleId;
      const lead = sampleData.find((item) => item.id === activeId);
      const heading = document.createElement('div');
      heading.className = 'portal-details-heading';
      heading.innerHTML = `<div><span>Lead details</span><strong>${escapeHtml(lead?.name || 'Sample lead')}</strong></div><button type="button" aria-label="Close lead details" data-close-details>×</button>`;
      sampleLeadPanel.prepend(heading);
    }
    decorateChannelBadges();
  }

  addMobileBack(document.querySelector('.production-thread-header'));
  const samplePaneObserver = new MutationObserver(addSampleDetailsButton);
  if (samplePane) samplePaneObserver.observe(samplePane, { childList: true, subtree: true });

  function leadStatus(lead, index) {
    const lastSource = lead.messages?.at(-1)?.[0];
    return {
      unreplied: lastSource === 'customer',
      followup: ['interested', 'new'].includes(lead.stage) && lastSource !== 'customer',
      unread: index < 5,
      attention: !!lead.attention,
    };
  }

  function matchesLead(lead, index) {
    const flags = leadStatus(lead, index);
    if (status !== 'all' && !flags[status]) return false;
    if (channel?.value && channel.value !== 'all' && lead.channel !== channel.value) return false;
    const hasStaffParticipation = Boolean(lead.messages?.some((row) => row?.[0] === 'staff'));
    if (owner?.value === 'ai' && hasStaffParticipation) return false;
    if (owner?.value === 'human' && !hasStaffParticipation) return false;
    const query = search?.value.trim().toLowerCase();
    if (query) {
      const haystack = [lead.name, lead.summary, lead.treatment, lead.branch, lead.source, ...(lead.messages || []).map((row) => row[1])]
        .filter(Boolean).join(' ').toLowerCase();
      if (!haystack.includes(query)) return false;
    }
    return true;
  }

  function ensureInboxFeedback(visibleCount) {
    const count = document.getElementById('portalConversationCount');
    if (count) count.textContent = String(visibleCount);

    let summary = document.getElementById('portalInboxFilterSummary');
    const selects = document.querySelector('.portal-select-grid');
    if (!summary && selects) {
      summary = document.createElement('div');
      summary.id = 'portalInboxFilterSummary';
      summary.className = 'portal-filter-summary';
      selects.insertAdjacentElement('afterend', summary);
    }
    if (summary) {
      const activeBits = [];
      if (status !== 'all') activeBits.push(status === 'attention' ? 'needs attention' : status);
      if (channel?.value && channel.value !== 'all') activeBits.push(channel.options[channel.selectedIndex]?.text || channel.value);
      if (owner?.value && owner.value !== 'all') activeBits.push(owner.options[owner.selectedIndex]?.text || owner.value);
      if (search?.value.trim()) activeBits.push(`“${search.value.trim()}”`);
      summary.textContent = activeBits.length ? `${visibleCount} matching · ${activeBits.join(' · ')}` : 'Showing all conversations';
    }

    let empty = document.getElementById('portalInboxEmpty');
    const scroll = document.querySelector('.portal-conversation-scroll');
    if (!empty && scroll) {
      empty = document.createElement('div');
      empty.id = 'portalInboxEmpty';
      empty.className = 'portal-filter-empty';
      empty.innerHTML = '<strong>No conversations match</strong><span>Try clearing a filter or changing your search.</span>';
      scroll.appendChild(empty);
    }
    empty?.classList.toggle('visible', visibleCount === 0);
  }

  function ensureVisibleConversationSelection() {
    const active = document.querySelector('.portal-conversation-card.active');
    if (!active?.hidden) return;
    const firstVisible = [liveCard, ...(sampleList?.querySelectorAll('[data-sample-id]') || [])]
      .find((card) => card && !card.hidden);
    firstVisible?.click();
  }

  function applyInboxFilters() {
    let visibleCount = 0;
    const cards = sampleList?.querySelectorAll('[data-sample-id]') || [];
    cards.forEach((card) => {
      const index = sampleData.findIndex((lead) => lead.id === card.dataset.sampleId);
      const lead = sampleData[index];
      card.hidden = !lead || !matchesLead(lead, index);
      if (!card.hidden) visibleCount += 1;
    });

    if (liveCard) {
      const query = search?.value.trim().toLowerCase() || '';
      const channelText = document.getElementById('conversationChannelTag')?.textContent?.toLowerCase() || 'whatsapp';
      const modeText = document.getElementById('modePill')?.textContent?.toLowerCase() || 'ai';
      let visible = status === 'all' || status === 'unread';
      if (status === 'attention') visible = !document.getElementById('attentionBanner')?.classList.contains('hidden');
      if (status === 'unreplied') visible = false;
      if (status === 'followup') visible = false;
      if (channel?.value !== 'all') visible = visible && channelText.includes(channel.value === 'facebook' ? 'messenger' : channel.value);
      if (owner?.value === 'ai') visible = visible && modeText.includes('ai');
      if (owner?.value === 'human') visible = visible && modeText.includes('human');
      if (query) visible = visible && ['demo patient', document.getElementById('conversationPreview')?.textContent || ''].join(' ').toLowerCase().includes(query);
      liveCard.hidden = !visible;
      if (visible) visibleCount += 1;
    }

    ensureInboxFeedback(visibleCount);
    ensureVisibleConversationSelection();
    decorateChannelBadges();
  }

  function refreshInboxCounts() {
    const buttons = document.querySelectorAll('.portal-status-filters [data-inbox-filter]');
    const totals = { all: sampleData.length + 1, unreplied: 0, followup: 0, unread: 1, attention: 0 };
    sampleData.forEach((lead, index) => {
      const flags = leadStatus(lead, index);
      Object.keys(flags).forEach((key) => { if (flags[key]) totals[key] += 1; });
    });
    if (!document.getElementById('attentionBanner')?.classList.contains('hidden')) totals.attention += 1;
    buttons.forEach((button) => {
      const count = button.querySelector('span');
      if (count) count.textContent = String(totals[button.dataset.inboxFilter] ?? totals.all);
    });
  }

  function syncToolPreview(key) {
    const label = { en: 'English', ms: 'Bahasa Malaysia', zh: '中文' }[key] || 'English';
    const previewLabel = document.getElementById('toolPreviewLanguage');
    const previewMessage = document.getElementById('toolPreviewMessage');
    if (previewLabel) previewLabel.textContent = label;
    if (previewMessage) previewMessage.textContent = langMessages[key] || langMessages.en || '';
  }

  document.querySelectorAll('.portal-status-filters [data-inbox-filter]').forEach((button) => {
    button.addEventListener('click', () => {
      status = button.dataset.inboxFilter || 'all';
      document.querySelectorAll('.portal-status-filters [data-inbox-filter]').forEach((item) => item.classList.toggle('active', item === button));
      requestAnimationFrame(applyInboxFilters);
    });
  });
  search?.addEventListener('input', applyInboxFilters);
  channel?.addEventListener('change', applyInboxFilters);
  owner?.addEventListener('change', applyInboxFilters);
  document.querySelectorAll('[data-lang]').forEach((button) => {
    button.addEventListener('click', () => syncToolPreview(button.dataset.lang || 'en'));
  });

  if (sampleList) {
    const listObserver = new MutationObserver(() => requestAnimationFrame(() => {
      applyInboxFilters();
      decorateChannelBadges();
    }));
    listObserver.observe(sampleList, { childList: true, subtree: false });
  }

  const attentionObserver = document.getElementById('attentionBanner');
  if (attentionObserver) new MutationObserver(() => {
    refreshInboxCounts();
    applyInboxFilters();
  }).observe(attentionObserver, { attributes: true, attributeFilter: ['class'] });

  const liveChannelAvatar = document.getElementById('dashboardChannelAvatar');
  if (liveChannelAvatar) new MutationObserver(() => requestAnimationFrame(decorateChannelBadges))
    .observe(liveChannelAvatar, { attributes: true, attributeFilter: ['class'] });

  function enhancePipelineSpecialButtons() {
    const buttons = Array.from(document.querySelectorAll('.production-filterchips button'));
    Object.entries(PIPELINE_SPECIAL).forEach(([key, config]) => {
      const button = buttons.find((item) => item.textContent.trim().startsWith(config.label));
      if (!button) return;
      button.classList.remove('portal-demo-only');
      button.removeAttribute('data-demo-only');
      button.dataset.pipelineSpecial = key;
      button.setAttribute('aria-label', `Filter pipeline: ${config.label}`);
    });
  }

  function pipelineLead(id) {
    return sampleData.find((lead) => lead.id === id) || null;
  }

  function refreshPipelineSpecialCounts() {
    Object.entries(PIPELINE_SPECIAL).forEach(([key, config]) => {
      const button = document.querySelector(`[data-pipeline-special="${key}"]`);
      const count = button?.querySelector('span');
      if (count) count.textContent = String(sampleData.filter(config.matches).length);
    });
  }

  function removeSpecialEmptyStates() {
    pipelineBoard?.querySelectorAll('.kanban-filter-empty').forEach((item) => item.remove());
  }

  function updateStageForVisibleCards(stage) {
    const visibleCards = Array.from(stage.querySelectorAll('.kanban-card')).filter((card) => !card.hidden);
    const count = stage.querySelector('.kanban-stage-count');
    if (count) count.textContent = String(visibleCards.length);
    const value = visibleCards.reduce((sum, card) => sum + (pipelineLead(card.dataset.pipelineLead)?.value || 0), 0);
    const valueLine = stage.querySelector('.kanban-stage-header p');
    if (valueLine) valueLine.textContent = `${formatMoney(value)} estimated value`;
    const cards = stage.querySelector('.kanban-cards');
    if (cards && visibleCards.length === 0 && !cards.querySelector('.kanban-empty') && !cards.querySelector('.kanban-filter-empty')) {
      const empty = document.createElement('div');
      empty.className = 'kanban-filter-empty';
      empty.textContent = 'No matching leads';
      cards.appendChild(empty);
    }
  }

  function applySpecialPipelineFilter() {
    if (!specialPipelineFilter || !pipelineBoard) return;
    const config = PIPELINE_SPECIAL[specialPipelineFilter];
    if (!config) return;
    removeSpecialEmptyStates();
    pipelineBoard.querySelectorAll('.kanban-card').forEach((card) => {
      const lead = pipelineLead(card.dataset.pipelineLead);
      card.hidden = !config.matches(lead);
    });
    pipelineBoard.querySelectorAll('.kanban-stage').forEach(updateStageForVisibleCards);
    decorateChannelBadges();
  }

  function setSpecialPipelineFilter(key) {
    const config = PIPELINE_SPECIAL[key];
    if (!config) return;
    const allButton = document.querySelector('[data-pipeline-category="all"]');
    suppressStandardPipelineReset = true;
    allButton?.click();
    suppressStandardPipelineReset = false;
    specialPipelineFilter = key;
    document.querySelectorAll('.production-filterchips button').forEach((button) => {
      button.classList.toggle('active', button.dataset.pipelineSpecial === key);
    });
    requestAnimationFrame(applySpecialPipelineFilter);
  }

  enhancePipelineSpecialButtons();
  refreshPipelineSpecialCounts();

  document.querySelectorAll('[data-pipeline-special]').forEach((button) => {
    button.addEventListener('click', () => setSpecialPipelineFilter(button.dataset.pipelineSpecial));
  });

  document.querySelectorAll('[data-pipeline-category]').forEach((button) => {
    button.addEventListener('click', () => {
      if (suppressStandardPipelineReset) return;
      specialPipelineFilter = null;
      removeSpecialEmptyStates();
    });
  });

  pipelineSearch?.addEventListener('input', () => {
    if (specialPipelineFilter) requestAnimationFrame(applySpecialPipelineFilter);
  });

  if (pipelineBoard) {
    const boardObserver = new MutationObserver(() => requestAnimationFrame(() => {
      decorateChannelBadges();
      refreshPipelineSpecialCounts();
      if (specialPipelineFilter) applySpecialPipelineFilter();
    }));
    boardObserver.observe(pipelineBoard, { childList: true, subtree: false });
  }

  document.getElementById('pipelineBranchStrip')?.addEventListener('click', () => {
    if (specialPipelineFilter) requestAnimationFrame(applySpecialPipelineFilter);
  });

  const copyObserver = new MutationObserver(normalizeBookingCopy);
  const tourStatus = document.getElementById('tourStatus');
  const toast = document.getElementById('toast');
  if (tourStatus) copyObserver.observe(tourStatus, { childList: true, characterData: true, subtree: true });
  if (toast) copyObserver.observe(toast, { childList: true, characterData: true, subtree: true });

  refreshInboxCounts();
  applyInboxFilters();
  syncToolPreview('en');
  normalizeBookingCopy();
  decorateChannelBadges();
})();
