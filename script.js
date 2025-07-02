document.addEventListener('DOMContentLoaded', () => {
  // Références DOM
  const driveModal      = document.getElementById('driveModal');
  const driveIframe     = document.getElementById('driveIframe');
  const formSection     = document.getElementById('booking-form-section');
  const recapSection    = document.getElementById('booking-recap-section');
  const successSection  = document.getElementById('booking-success-section');
  const showRecapBtn    = document.getElementById('show-recap-btn');
  const backBtn         = document.getElementById('back-to-form-btn');
  const confirmBtn      = document.getElementById('confirm-booking-btn');
  const recapContent    = document.getElementById('recap-content');
  const form            = document.getElementById('fauteuilBookingForm');
  const dureeSelect     = document.getElementById('duree');

  // Rendre la picklist ouvrable mais non sélectionnable
let lastSelectedIndex = dureeSelect.selectedIndex;
dureeSelect.addEventListener('mousedown', function(e) {
  lastSelectedIndex = dureeSelect.selectedIndex;
});
dureeSelect.addEventListener('change', function(e) {
  dureeSelect.selectedIndex = lastSelectedIndex;
  e.preventDefault();
});

  // 1. Modal Google Drive
  driveModal.addEventListener('show.bs.modal', e => {
    const btn = e.relatedTarget;
    const fileUrl = btn.dataset.fileUrl;
    // Si c'est une image, affiche-la dans une balise <img>, sinon dans l'iframe
    if (fileUrl && /\.(jpe?g|png|gif|webp|bmp|svg)$/i.test(fileUrl)) {
      driveIframe.style.display = 'none';
      if (!document.getElementById('modal-img')) {
        const img = document.createElement('img');
        img.id = 'modal-img';
        img.style.maxWidth = '100%';
        img.style.maxHeight = '70vh';
        img.style.display = 'block';
        img.style.margin = '0 auto';
        driveIframe.parentNode.insertBefore(img, driveIframe);
      }
      document.getElementById('modal-img').src = fileUrl;
      document.getElementById('modal-img').style.display = 'block';
    } else {
      driveIframe.style.display = 'block';
      driveIframe.src = fileUrl || '';
      if (document.getElementById('modal-img')) {
        document.getElementById('modal-img').style.display = 'none';
      }
    }
    driveModal.querySelector('.modal-title').textContent = btn.textContent.trim();
  });
  driveModal.addEventListener('hidden.bs.modal', () => {
    driveIframe.src = '';
    if (document.getElementById('modal-img')) {
      document.getElementById('modal-img').src = '';
      document.getElementById('modal-img').style.display = 'none';
    }
  });
  

  // 2. Sélecteur de plage de dates (Litepicker)
  let dateRangeStart = '';
  let dateRangeEnd = '';
  const dateRangeInput = document.getElementById('date_range');
  if (dateRangeInput) {
    const picker = new Litepicker({
      element: dateRangeInput,
      singleMode: false,
      format: 'YYYY-MM-DD',
      lang: 'fr-FR',
      autoApply: true,
      numberOfMonths: 2,
      numberOfColumns: 2,
      minDate: new Date().toISOString().slice(0,10),
      setup: (picker) => {
        picker.on('selected', (start, end) => {
          dateRangeStart = start ? start.format('YYYY-MM-DD') : '';
          dateRangeEnd   = end ? end.format('YYYY-MM-DD') : '';
          updateSingleDayOptions();
          calculatePrice();
        });
      }
    });
    dateRangeInput.addEventListener('change', () => {
      const parts = dateRangeInput.value.split(' - ');
      dateRangeStart = parts[0] || '';
      dateRangeEnd   = parts[1] || '';
      updateSingleDayOptions();
      calculatePrice();
    });
  }

  // 3. Calcul du nombre de jours ouvrés (hors dimanche/lundi)
  function countWorkDays(start, end) {
    if (!start || !end) return 0;
    let count = 0;
    let d = new Date(start);
    const dEnd = new Date(end);
    while (d <= dEnd) {
      if (![0,1].includes(d.getDay())) count++;
      d.setDate(d.getDate() + 1);
    }
    return count;
  }

  // 4. Détermination automatique de la formule et du tarif
  function getFormuleAndTarif(workDays, singleDayType) {
    if (workDays <= 0) return { formule: '', base: 0, txt: '' };
    if (workDays === 1) {
      if (singleDayType === 'heure') return { formule: "heure", base: 10, txt: "À l'heure – 10 € HT" };
      if (singleDayType === 'demi-journee') return { formule: "demi-journee", base: 45, txt: "Demi-journée (4h) – 45 € HT" };
      return { formule: "journee", base: 70, txt: "Journée complète – 70 € HT" };
    }
    // Découpage en mois/semaines/jours
    const nbMois = Math.floor(workDays / 20);
    const resteApresMois = workDays % 20;
    const nbSemaines = Math.floor(resteApresMois / 5);
    // Affiche la tranche dominante
    if (nbMois >= 12) return { formule: "12mois", base: 55, txt: "12 mois – 55 €/jour HT" };
    if (nbMois >= 6)  return { formule: "6mois", base: 60, txt: "6 mois – 60 €/jour HT" };
    if (nbMois >= 3)  return { formule: "3mois", base: 70, txt: "3 mois – 70 €/jour HT" };
    if (nbMois >= 1)  return { formule: "mois", base: 70, txt: "Mois – 70 €/jour HT" };
    if (nbSemaines >= 1) return { formule: "semaine", base: 280, txt: "Semaine (5 jours ouvrés) – 280 € HT" };
    return { formule: "journee", base: 70, txt: "Journée complète – 70 € HT" };
  }
  

  // 5. Calcul des prix
  function calculatePrice() {
    const packSel  = document.getElementById('pack');
    const workDays = countWorkDays(dateRangeStart, dateRangeEnd);
    let singleDayType = null;
    const singleDayTypeSelect = document.getElementById('singleDayType');
    if (workDays === 1 && singleDayTypeSelect) singleDayType = singleDayTypeSelect.value;
  
    // Découpage
    const nbMois = Math.floor(workDays / 20);
    const resteApresMois = workDays % 20;
    const nbSemaines = Math.floor(resteApresMois / 5);
    const resteJours = resteApresMois % 5;
  
    let dureePrice = 0;
    if (nbMois > 0) {
      const base = nbMois >= 12 ? 55 : nbMois >= 6 ? 60 : 70;
      dureePrice += nbMois * 20 * base;
    }
    if (nbSemaines > 0) dureePrice += nbSemaines * 280;
    if (resteJours > 0) dureePrice += resteJours * 70;
    if (workDays === 1) {
      const { base } = getFormuleAndTarif(workDays, singleDayType);
      dureePrice = base;
    }
  
    const packPrice = (parseInt(packSel.selectedOptions[0]?.dataset.prix) || 0) * workDays;
  
    // Affichage info formule principale
    const { formule, txt } = getFormuleAndTarif(workDays, singleDayType);
    setDureeSelect(formule);
    const dureeInfoDiv = document.getElementById('duree-info');
    if (dureeInfoDiv) dureeInfoDiv.textContent = txt;
  
    return { total: dureePrice + packPrice, dureePrice, packPrice, workDays, formule, txt };
  }


  // Sélection dynamique de la formule dans le select (picklist non éditable)
  function setDureeSelect(formule) {
    const dureeSel = document.getElementById('duree');
    if (!dureeSel) return;
    for (const opt of dureeSel.options) {
      opt.selected = (opt.value === formule);
    }
  }

  // 6. Affichage dynamique de l'option single-day
  function updateSingleDayOptions() {
    const workDays = countWorkDays(dateRangeStart, dateRangeEnd);
    const singleDayDiv = document.getElementById('single-day-options');
    if (singleDayDiv) {
      singleDayDiv.style.display = (workDays === 1) ? '' : 'none';
    }
  }
  // Écouteur sur le select single day
  const singleDayTypeSelect = document.getElementById('singleDayType');
  if (singleDayTypeSelect) {
    singleDayTypeSelect.addEventListener('change', calculatePrice);
  }

  // 7. Détails du pack
  const packSelect = document.getElementById('pack');
  const packDetailsDiv = document.getElementById('pack-details');
  const packDetailsMap = {
    'essentiel': '1 tondeuse classique, 1 finition, 2 serviettes, 1 cape lavable, accès au sèche-cheveux.',
    'premium':   '1 tondeuse classique, 1 finition, shaver, 4 serviettes, 1 cape lavable, sèche-cheveux.'
  };
  if (packSelect && packDetailsDiv) {
    packSelect.addEventListener('change', function() {
      packDetailsDiv.textContent = packDetailsMap[this.value] || '';
    });
    packDetailsDiv.textContent = packDetailsMap[packSelect.value] || '';
  }

  // 8. Validation des champs obligatoires
  function resetValidation() {
    form.querySelectorAll('.is-invalid').forEach(f => f.classList.remove('is-invalid'));
  }
  function validateFields() {
    resetValidation();
    let ok = true;
    ['nom','email','telephone','date_range'].forEach(id => {
      const el = document.getElementById(id);
      if (!el || !el.value.trim()) {
        if (el) el.classList.add('is-invalid');
        ok = false;
      }
    });
    // Validation stricte de la plage de dates
    if (!dateRangeStart || !dateRangeEnd) {
      if (dateRangeInput) dateRangeInput.classList.add('is-invalid');
      ok = false;
    }
    // Si un seul jour ouvré, vérifier le choix singleDayType
    const workDays = countWorkDays(dateRangeStart, dateRangeEnd);
    const singleDayTypeSelect = document.getElementById('singleDayType');
    if (workDays === 1 && singleDayTypeSelect && !singleDayTypeSelect.value) {
      singleDayTypeSelect.classList.add('is-invalid');
      ok = false;
    }
    return ok;
  }

  // 9. Génération du récapitulatif complet
  function generateRecap() {
    const data = {
      nom:       document.getElementById('nom').value,
      email:     document.getElementById('email').value,
      telephone: document.getElementById('telephone').value,
      debut:     dateRangeStart ? new Date(dateRangeStart).toLocaleDateString('fr-FR') : '',
      fin:       dateRangeEnd ? new Date(dateRangeEnd).toLocaleDateString('fr-FR') : '',
      packTxt:   document.getElementById('pack').selectedOptions[0]?.text || 'Aucun',
      msg:       document.getElementById('message').value || 'Aucun message'
    };
    const prices = calculatePrice();
    const details = packDetailsMap[packSelect.value] || '';

    recapContent.innerHTML = `
      <div class="recap-item"><strong>Nom :</strong> ${data.nom}</div>
      <div class="recap-item"><strong>Email :</strong> ${data.email}</div>
      <div class="recap-item"><strong>Téléphone :</strong> ${data.telephone}</div>
      <div class="recap-item"><strong>Début :</strong> ${data.debut}</div>
      <div class="recap-item"><strong>Fin :</strong> ${data.fin}</div>
      <div class="recap-item"><strong>Jours ouvrés :</strong> ${prices.workDays}</div>
      <div class="recap-item"><strong>Formule :</strong> ${prices.txt}</div>
      <div class="recap-item"><strong>Pack :</strong> ${data.packTxt}
        <div class="pack-details">${details}</div>
      </div>
      <div class="recap-item"><strong>Message :</strong> ${data.msg}</div>
      <div class="recap-item"><strong>Total :</strong> ${prices.total.toFixed(2)} € HT</div>
    `;
  }

  // 10. Envoi Formspree
  async function submitBooking(formData) {
    return fetch('https://formspree.io/f/mkgbzveo', {
      method: 'POST',
      body: formData,
      headers: { 'Accept': 'application/json' }
    }).then(resp => resp.ok);
  }

  // 11. Création événement Google Calendar
  async function createCalendarEvent(formData) {
    const workDays = countWorkDays(dateRangeStart, dateRangeEnd);
    let singleDayType = null;
    const singleDayTypeSelect = document.getElementById('singleDayType');
    if (workDays === 1 && singleDayTypeSelect) singleDayType = singleDayTypeSelect.value;
    const { formule } = getFormuleAndTarif(workDays, singleDayType);

    const payload = {
      nom:       formData.get('nom'),
      email:     formData.get('email'),
      telephone: formData.get('telephone'),
      dateDebut: dateRangeStart + 'T09:00:00',
      dateFin:   dateRangeEnd + 'T18:00:00',
      formule:   formule,
      pack:      formData.get('pack') || 'Aucun'
    };
    return fetch('https://script.google.com/macros/s/AKfycbyCCkXMr5QubKQvqIF3LXbmJ5KSjxxlON7pjiUq9XwdTfKAnYYlPRjE4CPTSPCMAv_i/exec', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    })
    .then(res => res.json())
    .then(json => json.success)
    .catch(() => false);
  }

  // 12. Événement bouton “Voir le récapitulatif”
  showRecapBtn.addEventListener('click', e => {
    e.preventDefault();
    if (validateFields()) {
      const formData = new FormData(form);
      formData.append('_subject', 'Nouvelle réservation PHENO&CO');  
      generateRecap();
      formSection.style.display  = 'none';
      recapSection.style.display = 'block';
    } else {
      alert('Merci de remplir tous les champs obligatoires.');  
    }
  });

  // 13. Bouton “Modifier”
  backBtn.addEventListener('click', () => {
    recapSection.style.display = 'none';
    formSection.style.display  = 'block';
  });

  // 14. Bouton “Confirmer”
  confirmBtn.addEventListener('click', async () => {
    confirmBtn.disabled = true;
    const formData = new FormData(form);
    formData.append('_subject', 'Nouvelle réservation PHENO&CO');
    const okForm = await submitBooking(formData);
    const okCal  = await createCalendarEvent(formData);
    recapSection.style.display = 'none';

    if (okForm) {
      successSection.style.display = 'block';
      if (okCal) console.log('Événement Google Calendar créé');  
      setTimeout(() => {
        form.reset();  
        successSection.style.display = 'none';
        formSection.style.display  = 'block';
        bootstrap.Modal.getInstance(document.getElementById('bookingModal')).hide();
        confirmBtn.disabled = false;
        updateSingleDayOptions();
        calculatePrice();
      }, 3000);
    } else {
      alert('Erreur lors de l’envoi. Veuillez réessayer.');  
      formSection.style.display = 'block';
      confirmBtn.disabled = false;
    }
  });

  // 15. Réinitialisation au closing modal
  document.getElementById('bookingModal').addEventListener('hidden.bs.modal', () => {
    form.reset();  
    resetValidation();  
    recapSection.style.display = 'none';
    formSection.style.display  = 'block';
    updateSingleDayOptions();
    calculatePrice();
  });

  // Initialisation affichage
  updateSingleDayOptions();
  calculatePrice();
});
