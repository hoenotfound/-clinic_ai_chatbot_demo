(() => {
  const shell = document.querySelector('.portal-shell');
  const sampleData = window.PORTAL_DEMO_DATA?.SAMPLE_LEADS || [];
  if (!shell) return;

  const search = document.getElementById('portalInboxSearch');
  const channel = document.getElementById('portalInboxChannel');
  const owner = document.getElementById('portalInboxOwner');
  const liveCard = document.getElementById('liveConversationCard');
  const sampleList = document.getElementById('sampleConversationList');
  const samplePane = document.getElementById('sampleConversationPane');
  const sampleLeadPanel = document.getElementById('sampleLeadPanel');
  const scrim = document.getElementById('portalDetailsScrim');
  let status = 'all';

  function closeDetails() {
    shell.classList.remove('details-open');
    scrim?.classList.add('hidden');
  }

  function openDetails() {
    shell.classList.add('details-open');
    scrim?.classList.remove('hidden');
  }

  document.addEventListener('click', (event) => {
    if (event.target.closest('[data-lead-details]')) openDetails();
    if (event.target.closest('[data-close-details]')) closeDetails();

    const conversation = event.target.closest('.portal-conversation-card');
    if (conversation && window.matchMedia('(max-width: 767px)').matches) {
      shell.classList.add('thread-open');
    }

    if (event.target.closest('[data-portal-page]')) {
      shell.classList.remove('thread-open');
      closeDetails();
    }
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
      heading.innerHTML = `<div><span>Lead details</span><strong>${lead?.name || 'Sample lead'}</strong></div><button type="button" aria-label="Close lead details" data-close-details>×</button>`;
      sampleLeadPanel.prepend(heading);
    }
  }

  addMobileBack(document.querySelector('.production-thread-header'));
  const observer = new MutationObserver(addSampleDetailsButton);
  if (samplePane) observer.observe(samplePane, { childList: true, subtree: true });

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
    if (owner?.value === 'ai' && lead.owner !== 'AI') return false;
    if (owner?.value === 'human' && lead.owner === 'AI') return false;
    const query = search?.value.trim().toLowerCase();
    if (query) {
      const haystack = [lead.name, lead.summary, lead.treatment, lead.branch, lead.source, ...(lead.messages || []).map((row) => row[1])]
        .filter(Boolean).join(' ').toLowerCase();
      if (!haystack.includes(query)) return false;
    }
    return true;
  }

  function applyInboxFilters() {
    const cards = sampleList?.querySelectorAll('[data-sample-id]') || [];
    cards.forEach((card) => {
      const index = sampleData.findIndex((lead) => lead.id === card.dataset.sampleId);
      const lead = sampleData[index];
      card.hidden = !lead || !matchesLead(lead, index);
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
    }
  }

  function refreshCounts() {
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

  if (sampleList) {
    const listObserver = new MutationObserver(() => requestAnimationFrame(applyInboxFilters));
    listObserver.observe(sampleList, { childList: true, subtree: false });
  }

  const attentionObserver = document.getElementById('attentionBanner');
  if (attentionObserver) new MutationObserver(refreshCounts).observe(attentionObserver, { attributes: true, attributeFilter: ['class'] });

  refreshCounts();
  applyInboxFilters();
})();
