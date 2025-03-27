$(document).ready(function () {

    // Initialize modal
    $('.modal').modal();

    let allNgrams = []; // Original dataset
    let currentData = []; // Currently displayed data (filtered or unfiltered)
    let currentPage = 1;
    const perPage = 50;
    let currentParams = {};

    $('#generate-btn').on('click', function() {
        $('#loading').show();
        
        currentParams = {
            num:            $('#window-size input[name="range"]:checked').val(),
            pad_left:       $('#padding-div input[name="pad_left"]').is(':checked') ? '1' : '0',
            pad_right:      $('#padding-div input[name="pad_right"]').is(':checked') ? '1' : '0',
            match_type:     $('input[name="search-type"]:checked').val(),
            explicit:       $('input[name="explicit-filtering"]:checked').val(),
            remove_pnc:     $('input[name="remove_punctuations"]').is(':checked') ? '1' : '0',
            edit_error:     $('input[name="error_editing"]').is(':checked') ? '1' : '0',
            remove_emoji:   $('input[name="remove_emojis"]').is(':checked') ? '1' : '0'
        };

        $.ajax({
            url: '/generate_ngrams',
            method: 'GET',
            data: {
                ...currentParams,
                page: 1
            },
            success: function(response) {
                allNgrams = response.ngrams;
                currentPage = 1;
                renderTable(allNgrams, currentPage);
                $('#loading').hide();
            },
            error: function(xhr) {
                $('#loading').hide();
                alert('Error: ' + (xhr.responseJSON?.error || 'Server error'));
            }
        });
    });

    function renderTable(data, page) {
        currentData = data; // Store current dataset
        const container = $('.ngram-results-container').empty().css('direction', 'rtl');
        const start = (page - 1) * perPage;
        const end = start + perPage;
        const paginatedData = data.slice(start, end);
    
        // Build table header
        let headerCells = '<th>#</th>';
        for(let i = 1; i <= currentParams.num; i++) {
            headerCells += `<th>Gram ${i}</th>`;
        }
        headerCells += '<th>Frequency</th>';
    
        // Create complete table structure
        const table = $(`
            <div class="input-field">
                <input class="validate" id="search" type="text">
                <label id="search-label" for="search">Search Query</label>
                <button class="btn waves-effect waves-light" id="search-btn" type="button">Search</button>
                <button class="btn waves-effect waves-light red" id="reset-btn" type="button">Reset</button>
                <button class="btn waves-effect waves-light green" id="download-btn" type="button">Download</button>
            </div>
            <table class="highlight">
                <thead><tr>${headerCells}</tr></thead>
                <tbody></tbody>
            </table>
        `);
    
        // Populate table body
        const tbody = table.find('tbody');
        paginatedData.forEach((ngram, index) => {
            const gramCells = ngram.gram.map(word => `<td>${word}</td>`).join('');
            const row = `
                <tr>
                    <td>${start + index + 1}</td>
                    ${gramCells}
                    <td>${ngram.count}</td>
                </tr>`;
            tbody.append(row);
        });
    
        container.append(table);
        addPagination(container, data.length, page);
    }

    // Download handler
    $(document).on('click', '#download-btn', function() {
        $('#download-modal').modal('open');
    });

    // Confirm download handler
    $(document).on('click', '#confirm-download', function() {
        const format = $('input[name="format"]:checked').val();
        downloadResults(format);
        $('.modal').modal('close');
    });

    function downloadResults(format) {
        if (!currentData.length) {
            alert('No data to download!');
            return;
        }

        let content = '';
        const filename = `ngrams-${new Date().toISOString()}.${format}`;
        
        if (format === 'csv') {
            content = convertToCSV(currentData);
        } else {
            content = convertToTXT(currentData);
        }

        const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
        const link = document.createElement('a');
        link.href = window.URL.createObjectURL(blob);
        link.download = filename;
        link.click();
    }

    function convertToCSV(data) {
        let csvContent = "Number,Gram,Frequency\n";
        data.forEach((ngram, index) => {
            const gramString = ngram.gram.join(',');
            csvContent += `${index + 1},${gramString},${ngram.count}\n`;
        });
        return csvContent;
    }

    function convertToTXT(data) {
        let txtContent = "N-gram Results\n\n";
        data.forEach((ngram, index) => {
            txtContent += `${index + 1}. ${ngram.gram.join(' ')} - Frequency: ${ngram.count}\n`;
        });
        return txtContent;
    }

    // Handle Enter key in search input
    $(document).on('keypress', '#search', function(e) {
        if(e.which === 13) { // 13 is Enter key code
            $('#search-btn').click();
            e.preventDefault(); // Prevent form submission if any
        }
    });

    // Add wildcard-to-regex helper function
    function wildcardToRegex(pattern) {
        // Escape special regex characters except * and ?
        const escaped = pattern.replace(/[.+^${}()|[\]\\]/g, '\\$&')
                            .replace(/\*/g, '.*')
                            .replace(/\?/g, '.');
        return new RegExp(`^${escaped}$`, 'i'); // Case-insensitive
    }

    // The search filter
    $(document).on('click', '#search-btn', function() {
        const searchTerm = $('#search').val().trim();
        
        if(!searchTerm) {
            currentData = allNgrams;
            currentPage = 1;
            renderTable(allNgrams, currentPage);
            return;
        }
        
        // Create regex from wildcard pattern
        const searchRegex = wildcardToRegex(searchTerm);
        
        const filtered = allNgrams.filter(ngram => 
            ngram.gram.some(word => 
                searchRegex.test(word)
            )
        );
        
        currentPage = 1;
        renderTable(filtered, currentPage);
    });

    function addPagination(container, totalItems, currentPage) {
        container.find(".pagination").remove();
        const totalPages = Math.ceil(totalItems / perPage);
        const pagination = $('<ul class="pagination"></ul>');

        // First/Previous buttons
        pagination.append(`
            <li class="${currentPage === 1 ? 'disabled' : 'waves-effect'}">
                <a href="#" data-page="1"><i class="material-icons">first_page</i></a>
            </li>
            <li class="${currentPage === 1 ? 'disabled' : 'waves-effect'}">
                <a href="#" data-page="${currentPage - 1}"><i class="material-icons">chevron_left</i></a>
            </li>
        `);

        // Page numbers
        const maxPages = 5;
        let startPage = Math.max(1, currentPage - Math.floor(maxPages/2));
        let endPage = Math.min(totalPages, startPage + maxPages - 1);
        
        if(endPage - startPage < maxPages - 1) {
            startPage = Math.max(1, endPage - maxPages + 1);
        }

        for(let i = startPage; i <= endPage; i++) {
            pagination.append(`
                <li class="${i === currentPage ? 'active' : 'waves-effect'}">
                    <a href="#" data-page="${i}">${i}</a>
                </li>
            `);
        }

        // Next/Last buttons
        pagination.append(`
            <li class="${currentPage >= totalPages ? 'disabled' : 'waves-effect'}">
                <a href="#" data-page="${currentPage + 1}"><i class="material-icons">chevron_right</i></a>
            </li>
            <li class="${currentPage >= totalPages ? 'disabled' : 'waves-effect'}">
                <a href="#" data-page="${totalPages}"><i class="material-icons">last_page</i></a>
            </li>
        `);

        container.append(pagination);

        // Pagination click handler
        pagination.on('click', 'a', function(e) {
            e.preventDefault();
            const newPage = Math.max(1, Math.min(totalPages, $(this).data('page')));
            if(newPage !== currentPage) {
                currentPage = newPage;
                renderTable(currentData, currentPage); // Use currentData instead of allNgrams
            }
        });
    }

    // Reset functionality
    $(document).on('click', '#reset-btn', function() {
        $('#search').val('');
        currentPage = 1;
        currentData = allNgrams; // Reset currentData to original
        renderTable(allNgrams, currentPage);
    });
});