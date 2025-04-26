document.addEventListener('DOMContentLoaded', function() {
    // Navigation mobile
    const menuToggle = document.querySelector('.menu-toggle');
    const nav = document.querySelector('nav');
    
    menuToggle.addEventListener('click', function() {
        nav.classList.toggle('active');
    });

    // Fermer le menu en cliquant sur un lien
    const navLinks = document.querySelectorAll('nav a');
    navLinks.forEach(link => {
        link.addEventListener('click', function() {
            nav.classList.remove('active');
        });
    });

    // Défilement fluide
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function(e) {
            e.preventDefault();
            const targetId = this.getAttribute('href');
            const targetSection = document.querySelector(targetId);
            
            window.scrollTo({
                top: targetSection.offsetTop,
                behavior: 'smooth'
            });
        });
    });

    // Gestion du formulaire de contact avec validation
    const contactForm = document.getElementById('contact-form');
    if (contactForm) {
        contactForm.addEventListener('submit', function(e) {
            e.preventDefault();
            
            // Valider le formulaire
            const validatedData = validateForm();
            
            if (validatedData) {
                // Afficher un message de chargement
                const submitBtn = contactForm.querySelector('button[type="submit"]');
                const originalBtnText = submitBtn.textContent;
                submitBtn.textContent = 'Envoi en cours...';
                submitBtn.disabled = true;
                
                // Redirection vers Google Forms avec les paramètres
                window.location.href = 'https://docs.google.com/forms/d/e/VOTRE_ID_DE_FORMULAIRE/viewform?usp=pp_url' +
                    '&entry.123456789=' + encodeURIComponent(validatedData.name) +
                    '&entry.987654321=' + encodeURIComponent(validatedData.email) +
                    '&entry.456123789=' + encodeURIComponent(validatedData.phone) +
                    '&entry.789123456=' + encodeURIComponent(validatedData.service) +
                    '&entry.321654987=' + encodeURIComponent(validatedData.message);
            }
        });
    }

    // Animation au défilement
    function revealOnScroll() {
        const elements = document.querySelectorAll('.service-card, .about-content, .contact-container');
        
        elements.forEach(element => {
            const elementTop = element.getBoundingClientRect().top;
            const windowHeight = window.innerHeight;
            
            if (elementTop < windowHeight - 100) {
                element.style.opacity = 1;
                element.style.transform = 'translateY(0)';
            }
        });
    }

    // Initialiser les styles pour l'animation
    const animatedElements = document.querySelectorAll('.service-card, .about-content, .contact-container');
    animatedElements.forEach(element => {
        element.style.opacity = 0;
        element.style.transform = 'translateY(20px)';
        element.style.transition = 'opacity 0.6s ease, transform 0.6s ease';
    });

    // Déclencher l'animation au chargement et au défilement
    revealOnScroll();
    window.addEventListener('scroll', revealOnScroll);

    // Gestion du carrousel
    function initCarousel() {
        const carouselInner = document.querySelector('.carousel-inner');
        const carouselItems = document.querySelectorAll('.carousel-item');
        const prevButton = document.querySelector('.carousel-prev');
        const nextButton = document.querySelector('.carousel-next');
        const indicators = document.querySelectorAll('.carousel-indicator');
        
        if (!carouselInner || !prevButton || !nextButton) return;
        
        let currentIndex = 0;
        const itemCount = carouselItems.length;
        
        function goToSlide(index) {
            if (index < 0) index = itemCount - 1;
            if (index >= itemCount) index = 0;
            
            carouselInner.style.transform = `translateX(-${index * 100}%)`;
            currentIndex = index;
            
            // Mise à jour des indicateurs
            indicators.forEach((indicator, i) => {
                if (i === index) {
                    indicator.classList.add('active');
                } else {
                    indicator.classList.remove('active');
                }
            });
        }
        
        // Gestion des clics sur les flèches
        prevButton.addEventListener('click', () => {
            goToSlide(currentIndex - 1);
        });
        
        nextButton.addEventListener('click', () => {
            goToSlide(currentIndex + 1);
        });
        
        // Gestion des clics sur les indicateurs
        indicators.forEach((indicator, index) => {
            indicator.addEventListener('click', () => {
                goToSlide(index);
            });
        });
        
        // Effet de fondu pour la transition des slides
        carouselItems.forEach(item => {
            item.addEventListener('transitionend', function() {
                if (parseFloat(getComputedStyle(item).opacity) === 0) {
                    item.style.opacity = 1;
                }
            });
        });
        
        // Carrousel automatique avec pause au survol
        let autoplayInterval = setInterval(() => {
            goToSlide(currentIndex + 1);
        }, 5000);
        
        // Gestion du hover
        const carousel = document.querySelector('.carousel');
        carousel.addEventListener('mouseenter', () => {
            clearInterval(autoplayInterval);
        });
        
        carousel.addEventListener('mouseleave', () => {
            autoplayInterval = setInterval(() => {
                goToSlide(currentIndex + 1);
            }, 5000);
        });
        
        // Initialisation du premier slide
        goToSlide(0);
    }

    // Initialiser le carrousel
    initCarousel();
});

// Ajouter cette fonction à votre script.js
function validateForm() {
    // Récupérer les valeurs du formulaire
    const name = document.getElementById('name').value.trim();
    const email = document.getElementById('email').value.trim();
    const phone = document.getElementById('phone').value.trim();
    const service = document.getElementById('service').value;
    const message = document.getElementById('message').value.trim();
    
    // Validation de base
    if (name.length < 2) {
        alert('Veuillez entrer un nom valide');
        return false;
    }
    
    // Validation d'email avec regex
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
        alert('Veuillez entrer une adresse email valide');
        return false;
    }
    
    // Validation du téléphone (optionnel mais doit être un format valide s'il est fourni)
    if (phone && !/^(\+[0-9]{1,3})?[0-9]{9,10}$/.test(phone.replace(/\s/g, ''))) {
        alert('Veuillez entrer un numéro de téléphone valide');
        return false;
    }
    
    // Validation du service sélectionné
    if (!service || service === '') {
        alert('Veuillez sélectionner un service');
        return false;
    }
    
    // Validation du message
    if (message.length < 10) {
        alert('Veuillez entrer un message d\'au moins 10 caractères');
        return false;
    }
    
    // Assainir les entrées (échapper les caractères spéciaux)
    const sanitizedData = {
        name: sanitizeInput(name),
        email: sanitizeInput(email),
        phone: sanitizeInput(phone),
        service: sanitizeInput(service),
        message: sanitizeInput(message)
    };
    
    // On pourra utiliser les données assainies pour l'envoi au serveur
    return sanitizedData;
}

// Fonction pour assainir les entrées
function sanitizeInput(input) {
    // Échapper les caractères spéciaux HTML
    return input
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
} 