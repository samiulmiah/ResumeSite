(function () {
  const projects = (window.SITE_DATA && window.SITE_DATA.projects) || [];
  const projectDetails = window.PROJECT_DETAILS || {};
  const grid = document.getElementById('projectGrid');
  let featuredCard = null;

  function restoreProjectOrder() {
    if (!grid) return;
    [...grid.querySelectorAll('.project-card')]
      .sort((a, b) => Number(a.dataset.index) - Number(b.dataset.index))
      .forEach(card => grid.appendChild(card));
  }

  function collapseFeatured() {
    if (!featuredCard) return;
    featuredCard.classList.remove('project-card--featured');
    const image = featuredCard.querySelector('.project-image');
    if (image) image.setAttribute('aria-expanded', 'false');
    featuredCard = null;
    restoreProjectOrder();
  }

  function toggleFeatured(card) {
    const wasFeatured = card === featuredCard;
    if (featuredCard) collapseFeatured();
    if (wasFeatured) return;

    featuredCard = card;
    card.classList.add('project-card--featured');
    const image = card.querySelector('.project-image');
    if (image) image.setAttribute('aria-expanded', 'true');
    grid.prepend(card);

    const work = document.getElementById('work');
    if (work) {
      const top = work.getBoundingClientRect().top + window.scrollY - 18;
      window.scrollTo({ top, behavior: 'smooth' });
    }
  }

  if (grid) {
    projects.forEach((project, index) => {
      const details = projectDetails[project.title] || {};
      const card = document.createElement('article');
      card.className = 'project-card';
      card.dataset.index = String(index);

      const expandedCopy = details.expandedDescription
        ? `<p class="project-expanded-copy">${details.expandedDescription}</p>`
        : `<p class="project-expanded-copy">Add your longer project description in <code>project-details.js</code>.</p>`;
      const documentLink = details.documentHref
        ? `<a class="project-document-link" href="${details.documentHref}" target="_blank" rel="noopener">${details.documentLabel || 'open project file ↗'}</a>`
        : '';

      card.innerHTML = `
        <div class="project-image" role="button" tabindex="0" aria-expanded="false" aria-label="Expand ${project.title}">
          <img src="${project.image}" alt="${project.alt}" loading="lazy" />
        </div>
        <div class="project-info">
          <div>
            <p class="meta">${project.type}</p>
            <h3>${project.title}</h3>
            <p>${project.description}</p>
            <div class="project-expanded-details" aria-label="More about ${project.title}">
              <p class="project-expanded-label">more about this project</p>
              ${expandedCopy}
              ${documentLink}
            </div>
            <button class="project-collapse" type="button">collapse project ↑</button>
          </div>
          <span class="project-index">0${index + 1}</span>
        </div>`;

      const image = card.querySelector('.project-image');
      const close = card.querySelector('.project-collapse');
      image.addEventListener('click', () => toggleFeatured(card));
      image.addEventListener('keydown', event => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          toggleFeatured(card);
        }
      });
      close.addEventListener('click', event => {
        event.stopPropagation();
        collapseFeatured();
      });
      grid.appendChild(card);
    });
  }

  /* Show a compact side navigation once the opening module has been passed. */
  const hero = document.getElementById('top');
  const sideNav = document.querySelector('.scroll-side-nav');
  const sideLinks = sideNav ? [...sideNav.querySelectorAll('a[href^="#"]')] : [];
  const sectionIds = ['work', 'research', 'about', 'resume', 'contact'];
  const sections = sectionIds.map(id => document.getElementById(id)).filter(Boolean);

  function updateSideNavVisibility() {
    if (!hero || !sideNav) return;
    const heroBottom = hero.getBoundingClientRect().bottom;
    document.body.classList.toggle('show-scroll-side-nav', heroBottom < 170);
  }

  function updateActiveSection() {
    if (!sideLinks.length || !sections.length) return;
    let current = sections[0].id;
    const marker = window.innerHeight * 0.34;
    sections.forEach(section => {
      if (section.getBoundingClientRect().top <= marker) current = section.id;
    });
    sideLinks.forEach(link => {
      link.classList.toggle('is-active', link.getAttribute('href') === `#${current}`);
    });
  }

  function updateScrollUI() {
    updateSideNavVisibility();
    updateActiveSection();
  }

  window.addEventListener('scroll', updateScrollUI, { passive: true });
  window.addEventListener('resize', updateScrollUI);
  updateScrollUI();

  function updateClock() {
    const now = new Date();
    const date = new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/Detroit',
      month: '2-digit', day: '2-digit', year: 'numeric'
    }).format(now);
    const time = new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/Detroit',
      hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true
    }).format(now);
    const clock = document.getElementById('siteTime');
    if (clock) clock.textContent = `${date} ${time} DET`;
  }

  updateClock();
  setInterval(updateClock, 1000);
  const year = document.getElementById('year');
  if (year) year.textContent = new Date().getFullYear();
})();

/* V14 side-navigation reliability patch. */
(function(){
  const sideNav=document.querySelector('.scroll-side-nav');
  const hero=document.getElementById('top');
  if(!sideNav)return;
  const links=[...sideNav.querySelectorAll('a[href^="#"]')];
  const ids=links.map(a=>a.getAttribute('href').slice(1));
  const sections=ids.map(id=>document.getElementById(id)).filter(Boolean);

  function syncSideNav(){
    if(hero){
      const show=hero.getBoundingClientRect().bottom<170;
      document.body.classList.toggle('show-scroll-side-nav',show);
    }
    if(!sections.length)return;
    const marker=Math.max(120,window.innerHeight*.34);
    let current=sections[0].id;
    sections.forEach(section=>{if(section.getBoundingClientRect().top<=marker)current=section.id;});
    links.forEach(link=>{
      const active=link.getAttribute('href')===`#${current}`;
      link.classList.toggle('is-active',active);
      if(active)link.setAttribute('aria-current','location');else link.removeAttribute('aria-current');
    });
  }

  links.forEach(link=>{
    link.addEventListener('click',event=>{
      const id=link.getAttribute('href').slice(1);
      const target=document.getElementById(id);
      if(!target)return;
      event.preventDefault();
      const top=target.getBoundingClientRect().top+window.scrollY-24;
      window.scrollTo({top,behavior:'smooth'});
      try{history.replaceState(null,'',`#${id}`);}catch(e){}
      setTimeout(syncSideNav,350);
    });
  });

  window.addEventListener('scroll',syncSideNav,{passive:true});
  window.addEventListener('resize',syncSideNav,{passive:true});
  syncSideNav();
})();
