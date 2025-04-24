document.addEventListener('DOMContentLoaded', function() {
    // DOM Elements
    const collectionSelect = document.getElementById('collection-select');
    const searchInput = document.getElementById('search-input');
    const searchButton = document.getElementById('search-button');
    const dataTable = document.getElementById('data-table');
    const dataBody = document.getElementById('data-body');
    const loadingElement = document.getElementById('loading');
    const noDataElement = document.getElementById('no-data');
    const prevPageButton = document.getElementById('prev-page');
    const nextPageButton = document.getElementById('next-page');
    const pageInfo = document.getElementById('page-info');
    const editModal = document.getElementById('edit-modal');
    const closeModalButton = document.querySelector('.close');
    const editForm = document.getElementById('edit-form');
    const cancelButton = document.querySelector('.btn-cancel');
    const checkStatusButton = document.getElementById('check-status');
    const statusIndicator = document.getElementById('status-indicator');
    const showAccessInfoButton = document.getElementById('show-access-info');
    const accessModal = document.getElementById('access-modal');
    const closeAccessButton = document.querySelector('.close-access');
    const accessInfoLoading = document.getElementById('access-info-loading');
    const accessInfoContent = document.getElementById('access-info-content');
    const accessUrlsContainer = document.getElementById('access-urls');

    // State
    let currentPage = 1;
    let totalPages = 1;
    let currentCollection = '';
    let currentLimit = 10;
    let currentSearch = '';
    let networkAddresses = [];

    // Initialize
    init();

    function init() {
        checkServerStatus();
        fetchCollections();
        setupEventListeners();
        showLoading(false);
        showNoData(true);
    }

    function setupEventListeners() {
        // Server status check
        checkStatusButton.addEventListener('click', checkServerStatus);

        // Global access info
        showAccessInfoButton.addEventListener('click', showAccessInfo);
        closeAccessButton.addEventListener('click', () => {
            accessModal.style.display = 'none';
        });

        // Close modals when clicking outside
        window.addEventListener('click', function(event) {
            if (event.target === editModal) {
                closeModal();
            }
            if (event.target === accessModal) {
                accessModal.style.display = 'none';
            }
        });

        // Collection change
        collectionSelect.addEventListener('change', function() {
            currentCollection = this.value;
            currentPage = 1;
            currentSearch = '';
            searchInput.value = '';
            fetchData();
        });

        // Search
        searchButton.addEventListener('click', function() {
            currentSearch = searchInput.value.trim();
            currentPage = 1;
            fetchData();
        });

        searchInput.addEventListener('keypress', function(event) {
            if (event.key === 'Enter') {
                currentSearch = searchInput.value.trim();
                currentPage = 1;
                fetchData();
            }
        });

        // Pagination
        prevPageButton.addEventListener('click', function() {
            if (currentPage > 1) {
                currentPage--;
                fetchData();
            }
        });

        nextPageButton.addEventListener('click', function() {
            if (currentPage < totalPages) {
                currentPage++;
                fetchData();
            }
        });

        // Modal
        closeModalButton.addEventListener('click', closeModal);
        cancelButton.addEventListener('click', closeModal);

        // Form submission
        editForm.addEventListener('submit', function(event) {
            event.preventDefault();
            updateRecord();
        });
    }

    async function checkServerStatus() {
        try {
            statusIndicator.textContent = "Checking...";
            statusIndicator.className = "";
            
            const response = await fetch('/api/collections');
            
            if (response.ok) {
                statusIndicator.textContent = "Online";
                statusIndicator.className = "online";
                console.log("Server is online");
            } else {
                statusIndicator.textContent = "Error";
                statusIndicator.className = "offline";
                console.error("Server returned error:", response.status);
            }
        } catch (error) {
            statusIndicator.textContent = "Offline";
            statusIndicator.className = "offline";
            console.error("Server connection error:", error);
        }
    }

    async function showAccessInfo() {
        accessModal.style.display = 'block';
        accessInfoLoading.style.display = 'block';
        accessInfoContent.style.display = 'none';
        accessUrlsContainer.innerHTML = '';
        
        try {
            // Fetch network info from server
            const response = await fetch('/api/server-info');
            
            if (response.ok) {
                const data = await response.json();
                
                if (data.success) {
                    const serverInfo = data.serverInfo;
                    
                    // Display access URLs
                    if (serverInfo.addresses && serverInfo.addresses.length > 0) {
                        networkAddresses = serverInfo.addresses;
                        
                        serverInfo.addresses.forEach(address => {
                            const url = `http://${address.address}:${serverInfo.port}`;
                            
                            const urlItem = document.createElement('div');
                            urlItem.className = 'access-url-item';
                            
                            const urlText = document.createElement('div');
                            urlText.innerHTML = `<strong>${address.interface}:</strong> ${url}`;
                            
                            const copyButton = document.createElement('button');
                            copyButton.className = 'copy-btn';
                            copyButton.textContent = 'Copy';
                            copyButton.addEventListener('click', function() {
                                copyToClipboard(url);
                                this.textContent = 'Copied!';
                                setTimeout(() => {
                                    this.textContent = 'Copy';
                                }, 2000);
                            });
                            
                            urlItem.appendChild(urlText);
                            urlItem.appendChild(copyButton);
                            accessUrlsContainer.appendChild(urlItem);
                        });
                    } else {
                        accessUrlsContainer.innerHTML = '<p>No network addresses found. Try checking the troubleshooting page.</p>';
                    }
                } else {
                    accessUrlsContainer.innerHTML = '<p>Error retrieving network information. Please try again.</p>';
                }
            } else {
                accessUrlsContainer.innerHTML = '<p>Error connecting to server. Please check if the server is running.</p>';
            }
        } catch (error) {
            console.error('Error fetching network info:', error);
            accessUrlsContainer.innerHTML = `<p>Error: ${error.message}</p>`;
        } finally {
            accessInfoLoading.style.display = 'none';
            accessInfoContent.style.display = 'block';
        }
    }

    function copyToClipboard(text) {
        navigator.clipboard.writeText(text).then(() => {
            console.log('Copied to clipboard:', text);
        }).catch(err => {
            console.error('Failed to copy text:', err);
            // Fallback for older browsers
            const textArea = document.createElement('textarea');
            textArea.value = text;
            document.body.appendChild(textArea);
            textArea.select();
            document.execCommand('copy');
            document.body.removeChild(textArea);
        });
    }

    async function fetchCollections() {
        try {
            const response = await fetch('/api/collections');
            const data = await response.json();

            if (data.success) {
                populateCollectionDropdown(data.collections);
            } else {
                console.error('Failed to fetch collections:', data.error);
            }
        } catch (error) {
            console.error('Error fetching collections:', error);
        }
    }

    function populateCollectionDropdown(collections) {
        // Clear existing options except the first one
        while (collectionSelect.options.length > 1) {
            collectionSelect.remove(1);
        }

        // Add new options
        collections.forEach(collection => {
            const option = document.createElement('option');
            option.value = collection;
            option.textContent = collection;
            collectionSelect.appendChild(option);
        });
    }

    async function fetchData() {
        if (!currentCollection) {
            showNoData(true);
            return;
        }

        showLoading(true);
        showNoData(false);

        try {
            const url = buildUrl();
            const response = await fetch(url);
            const data = await response.json();

            if (data.success) {
                renderData(data);
                updatePagination(data);
            } else {
                console.error('Failed to fetch data:', data.error);
                showNoData(true);
            }
        } catch (error) {
            console.error('Error fetching data:', error);
            showNoData(true);
        } finally {
            showLoading(false);
        }
    }

    function buildUrl() {
        let url = `/api/collections/${currentCollection}?page=${currentPage}&limit=${currentLimit}`;
        if (currentSearch) {
            url += `&search=${encodeURIComponent(currentSearch)}`;
        }
        return url;
    }

    function renderData(data) {
        dataBody.innerHTML = '';

        if (data.data.length === 0) {
            showNoData(true);
            return;
        }

        data.data.forEach(record => {
            const row = document.createElement('tr');
            
            // Name column
            const nameCell = document.createElement('td');
            nameCell.textContent = record.name || '-';
            row.appendChild(nameCell);
            
            // Father/Husband Name column
            const fatherNameCell = document.createElement('td');
            fatherNameCell.textContent = record.fatherName || '-';
            row.appendChild(fatherNameCell);
            
            // Address column
            const addressCell = document.createElement('td');
            addressCell.textContent = record.address || '-';
            row.appendChild(addressCell);
            
            // Phone Number column
            const phoneCell = document.createElement('td');
            phoneCell.textContent = record.phoneNumber || '-';
            row.appendChild(phoneCell);
            
            // Actions column
            const actionsCell = document.createElement('td');
            const editButton = document.createElement('button');
            editButton.textContent = 'Edit';
            editButton.className = 'action-btn edit-btn';
            editButton.addEventListener('click', () => openEditModal(record));
            actionsCell.appendChild(editButton);
            row.appendChild(actionsCell);
            
            dataBody.appendChild(row);
        });
    }

    function updatePagination(data) {
        totalPages = data.totalPages;
        pageInfo.textContent = `Page ${data.page} of ${data.totalPages}`;
        
        // Update button states
        prevPageButton.disabled = data.page <= 1;
        nextPageButton.disabled = data.page >= data.totalPages;
    }

    function openEditModal(record) {
        // Populate form with record data
        document.getElementById('record-id').value = record._id;
        document.getElementById('collection-name').value = currentCollection;
        document.getElementById('edit-name').value = record.name || '';
        document.getElementById('edit-father-name').value = record.fatherName || '';
        document.getElementById('edit-address').value = record.address || '';
        document.getElementById('edit-phone').value = record.phoneNumber || '';
        document.getElementById('edit-email').value = record.email || '';
        
        // Show modal
        editModal.style.display = 'block';
    }

    function closeModal() {
        editModal.style.display = 'none';
        editForm.reset();
    }

    async function updateRecord() {
        const recordId = document.getElementById('record-id').value;
        const collectionName = document.getElementById('collection-name').value;
        
        const updatedData = {
            name: document.getElementById('edit-name').value,
            fatherName: document.getElementById('edit-father-name').value,
            address: document.getElementById('edit-address').value,
            phoneNumber: document.getElementById('edit-phone').value,
            email: document.getElementById('edit-email').value
        };
        
        try {
            const response = await fetch(`/api/collections/${collectionName}/${recordId}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(updatedData)
            });
            
            const result = await response.json();
            
            if (result.success) {
                closeModal();
                fetchData(); // Refresh the data
                alert('Record updated successfully!');
            } else {
                alert('Failed to update record: ' + result.error);
            }
        } catch (error) {
            console.error('Error updating record:', error);
            alert('Error updating record');
        }
    }

    function showLoading(show) {
        loadingElement.style.display = show ? 'block' : 'none';
        dataTable.style.display = show ? 'none' : 'table';
    }

    function showNoData(show) {
        noDataElement.style.display = show ? 'block' : 'none';
        dataTable.style.display = show ? 'none' : 'table';
    }
}); 