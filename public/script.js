document.addEventListener('DOMContentLoaded', () => {
    const reservationForm = document.getElementById('reservation-form');
    const reservationsList = document.getElementById('reservations-list');

    // Functie om reserveringen op te halen en weer te geven
    const fetchReservations = async () => {
        try {
            const response = await fetch('/api/reservations');
            if (!response.ok) {
                throw new Error('Kon reserveringen niet ophalen.');
            }
            const reservations = await response.json();
            
            reservationsList.innerHTML = ''; // Leeg de lijst voordat je opnieuw opbouwt

            reservations.forEach(res => {
                const reservationEl = document.createElement('div');
                reservationEl.classList.add('reservation');
                reservationEl.innerHTML = `
                    <div>
                        <strong>Titel:</strong> ${res.Titel} <br>
                        <strong>Start:</strong> ${new Date(res.Start_Date_Time).toLocaleString()} <br>
                        <strong>Eind:</strong> ${new Date(res.End_Date_Time).toLocaleString()} <br>
                        <strong>Locatie:</strong> ${res.Locatie}
                    </div>
                    <div class="actions">
                        <button class="delete-btn" 
                            data-start="${res.Start_Date_Time}" 
                            data-end="${res.End_Date_Time}" 
                            data-location="${res.Locatie}">Verwijder</button>
                    </div>
                `;
                reservationsList.appendChild(reservationEl);
            });
        } catch (error) {
            console.error(error);
            reservationsList.innerHTML = '<p>Kon reserveringen niet laden.</p>';
        }
    };

    // Functie om een reservering te verwijderen
    const deleteReservation = async (start, end, location) => {
        const contactpersoon = prompt('Voer de naam van de contactpersoon in om te bevestigen:');
        if (!contactpersoon) {
            alert('Verwijderen geannuleerd.');
            return;
        }

        try {
            const params = new URLSearchParams({ start, end, location });
            const response = await fetch(`/api/reservations?${params.toString()}`, {
                method: 'DELETE',
                headers: {
                    'x-contact-person': contactpersoon
                }
            });

            if (response.ok) {
                alert('Reservering succesvol verwijderd.');
                fetchReservations(); // Herlaad de lijst
            } else {
                const result = await response.json();
                alert(`Fout: ${result.error}`);
            }
        } catch (error) {
            console.error('Fout bij verwijderen:', error);
            alert('Kon de reservering niet verwijderen.');
        }
    };

    // Event listener voor het toevoegen van een reservering
    reservationForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const formData = new FormData(reservationForm);
        const data = Object.fromEntries(formData.entries());

        try {
            const response = await fetch('/api/reservations', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(data)
            });

            if (response.ok) {
                alert('Reservering succesvol aangemaakt!');
                reservationForm.reset();
                fetchReservations(); // Herlaad de lijst
            } else {
                const result = await response.json();
                alert(`Fout: ${result.error}`);
            }
        } catch (error) {
            console.error('Fout bij aanmaken:', error);
            alert('Kon de reservering niet aanmaken.');
        }
    });

    // Event listener voor de verwijder-knoppen (event delegation)
    reservationsList.addEventListener('click', (e) => {
        if (e.target && e.target.classList.contains('delete-btn')) {
            const button = e.target;
            const start = button.getAttribute('data-start');
            const end = button.getAttribute('data-end');
            const location = button.getAttribute('data-location');
            deleteReservation(start, end, location);
        }
    });

    // Haal de reserveringen op bij het laden van de pagina
    fetchReservations();
});
