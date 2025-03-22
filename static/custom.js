$(document).ready(function () {
    console.log("jQuery version:", $.fn.jquery); // Check jQuery version
    console.log("jQuery UI version:", $.ui ? $.ui.version : "jQuery UI not loaded"); // Check jQuery UI version

    $('.modal').modal();

    let resultsData = [];
    let searchQuery = '';
    let totalFrequency = 0;
    let selectedRow = null;

    $('.modal').modal();

    function getSearchResults(query, page, window, callback) {
        $.ajax({
            url: '/search',
            method: 'GET',
            data: { q: query, page: page, window: window },
            success: function (response) {
                searchQuery = query;
                resultsData = response.results; // Store results in the global variable
                totalFrequency = response.total_frequency;
                callback(response);
            }
        });
    }

    function displaySearchResults(response, page) {
        var resultsTable = $('#results-table tbody');
        var pagination = $('#pagination');
        resultsTable.empty();
        pagination.empty();

        // Get the window size from the global variable
        let window = Number($('input[name="range"]:checked').val());
        let headers = convertNumberToList(window);

        resultsTable.append(`
            <tr>
              <th>#</th>
              ${headers.map(header => {
                if (header === 'KWIC') {
                  return `<th class="kwic">${header}</th>`;
                } else {
                  return `<th class="context-column">${header}</th>`;
                }
              }).join('')}
            </tr>
          `);

        response.results.forEach(function (result, index) {
            const rightContext = result.context.slice(0, window);
            const kwic = result.context[window];
            const leftContext = result.context.slice(window + 1);

            let rightContextsHtml = rightContext.map(word =>
                `<td class="context-column">${word}</td>`
            ).join('');

            let leftContextsHtml = leftContext.map(word =>
                `<td class="context-column">${word}</td>`
            ).join('');
            
            resultsTable.append(
                `<tr data-index="${result.sentence_index}">
                    <td>${(page - 1) * response.per_page + index + 1}</td>
                    ${rightContextsHtml}
                    <td class="kwic">${kwic}</td>
                    ${leftContextsHtml}
                </tr>`
            );
        });

        // Add radio buttons for headers to the sort modal
        let sortHeaders = $('#sort-headers');
        sortHeaders.empty(); // Clear previous radio buttons
        headers.forEach((header, index) => {
            sortHeaders.append(`
                <label>
                    <input name="header" type="radio" value="${index}" ${index === 0 ? 'checked' : ''} />
                    <span>${header}</span>
                </label>
            `);
        });

        var totalPages = Math.ceil(response.total_results / response.per_page);
        var maxPagesToShow = 5;
        var startPage = Math.max(1, page - Math.floor(maxPagesToShow / 2));
        var endPage = Math.min(totalPages, startPage + maxPagesToShow - 1);

        if (page > 1) {
            pagination.append('<li class="waves-effect"><a href="#" data-page="1"><i class="material-icons">first_page</i></a></li>');
            pagination.append('<li class="waves-effect"><a href="#" data-page="' + (page - 1) + '"><i class="material-icons">chevron_left</i></a></li>');
        } else {
            pagination.append('<li class="disabled"><a href="#"><i class="material-icons">first_page"></i></a></li>');
            pagination.append('<li class="disabled"><a href="#"><i class="material-icons">chevron_left"></i></a></li>');
        }

        for (var i = startPage; i <= endPage; i++) {
            if (i === page) {
                pagination.append('<li class="active"><a href="#">' + i + '</a></li>');
            } else {
                pagination.append('<li class="waves-effect"><a href="#" data-page="' + i + '">' + i + '</a></li>');
            }
        }

        if (page < totalPages) {
            pagination.append('<li class="waves-effect"><a href="#" data-page="' + (page + 1) + '"><i class="material-icons">chevron_right</i></a></li>');
            pagination.append('<li class="waves-effect"><a href="#" data-page="' + totalPages + '"><i class="material-icons">last_page</i></a></li>');
        } else {
            pagination.append('<li class="disabled"><a href="#"><i class="material-icons">chevron_right"></i></a></li>');
            pagination.append('<li class="disabled"><a href="#"><i class="material-icons">last_page"></i></a></li>');
        }
    }

    function performSearch() {
        var query = $('#search').val();
        let window = Number($('input[name="range"]:checked').val());
        getSearchResults(query, 1, window, function(response) {
            displaySearchResults(response, 1);
        });
    }

    function calculateFrequency() {
        $('#dynamic-content').html(`<p>The word "${searchQuery}" appears ${totalFrequency} times in the results.</p>`);
        $('#dynamic-content-modal').modal('open');
    }

    $('#search-btn').on('click', function () {
        performSearch();
    });

    $('#search').on('keypress', function (e) {
        if (e.which === 13) {
            performSearch();
        }
    });

    $(document).on('click', '#pagination a', function (e) {
        e.preventDefault();
        var page = $(this).data('page');
        var query = $('#search').val();
        let window = Number($('input[name="range"]:checked').val());
        getSearchResults(query, page, window, function(response) {
            displaySearchResults(response, page);
        });
    });

    $(document).on('click', '#statistics-option', function (e) {
        e.preventDefault();
        calculateFrequency();
    });

    $('.option').on('click', function (e) {
        e.preventDefault();
        var option = $(this).data('option');
        if (option == 4) {
            $('#download-modal').modal('open');
        } else if (option == 5) {
            $('#sort-modal').modal('open');
        } else if (option == 3) {
            if (selectedRow !== null) {
                fetchSentence(selectedRow);
            } else {
                alert("Please select a result to view the full sentence.");
            }
        } else {
            $('#dynamic-content').html('<p>Content for Option ' + option + '</p>');
            $('#dynamic-content-modal').modal('open');
        }
    });

    $('#download-btn').on('click', function () {
        var selectedFormat = $('input[name="format"]:checked').val();
        downloadResults(selectedFormat);
    });

    $(document).on('click', '#results-table tbody tr', function () {
        const rowIndex = $(this).data('index');
        if ($(this).hasClass('selected')) {
            selectedRow = null;
            $(this).removeClass('selected');
        } else {
            $('#results-table tbody tr').removeClass('selected');
            selectedRow = rowIndex;
            $(this).addClass('selected');
        }
    });

    function fetchSentence(index) {
        $.ajax({
            url: '/sentence',
            method: 'GET',
            data: { index: index },
            success: function (response) {
                var sentence = response.sentence;
                var sentenceHtml = sentence.map(function (tokenData) {
                    return tokenData.token;
                }).join(' ');
                $('#dynamic-content').html(`<div style="direction: rtl;">${sentenceHtml}</div>`);
                $('#dynamic-content-modal').modal('open');
            },
            error: function (xhr, status, error) {
                console.error("Error fetching sentence:", error);
            }
        });
    }

    function downloadResults(format) {
        let dataStr;
        let filename;
        let filteredResults = resultsData.filter(result => result.sentence_index === selectedRow);

        if (selectedRow === null) {
            filteredResults = resultsData.map(result => result.context);
        }

        if (format === 'csv') {
            let csvContent = "data:text/csv;charset=utf-8,";
            csvContent += "Index,R5,R4,R3,R2,R1,KWIC,L1,L2,L3,L4,L5\n";
            filteredResults.forEach((row, index) => {
                csvContent += `${index + 1},${row.slice(0, 5).join(',')},${row[5]},${row.slice(6).join(',')}\n`;
            });
            dataStr = encodeURI(csvContent);
            filename = 'results.csv';
        } else {
            let txtContent = "data:text/plain;charset=utf-8,";
            filteredResults.forEach((row, index) => {
                txtContent += `Index: ${index + 1}\nLeft Context: ${row.slice(0, 5).join(' ')}\nKWIC: ${row[5]}\nRight Context: ${row.slice(6).join(' ')}\n\n`;
            });
            dataStr = encodeURI(txtContent);
            filename = 'results.txt';
        }

        var downloadAnchor = document.createElement('a');
        downloadAnchor.setAttribute('href', dataStr);
        downloadAnchor.setAttribute('download', filename);
        document.body.appendChild(downloadAnchor);
        downloadAnchor.click();
        document.body.removeChild(downloadAnchor);
    }

    function sortSearchResults(index, order) {
        // Sort the searchResults based on the specified index of the embedded lists and order type
        resultsData.sort((a, b) => {
            if (order === 'ascending') {
                if (a.context[index] < b.context[index]) {
                    return -1;
                }
                if (a.context[index] > b.context[index]) {
                    return 1;
                }
            } else {
                if (a.context[index] > b.context[index]) {
                    return -1;
                }
                if (a.context[index] < b.context[index]) {
                    return 1;
                }
            }
            return 0;
        });
    }

    $('#sort-btn').on('click', function () {
        const selectedHeaderIndex = $('input[name="header"]:checked').val();
        const selectedOrder = $('input[name="order"]:checked').val();
        sortSearchResults(selectedHeaderIndex, selectedOrder);
        displaySearchResults({ results: resultsData }, 1);
        $('#sort-modal').modal('close');
    });
    function convertNumberToList(n) {
        let result = [];
        for (let i = n; i > 0; i--) {
          result.push(`R${i}`);
        }
        result.push('KWIC');
        for (let i = 1; i <= n; i++) {
          result.push(`L${i}`);
        }
        return result;
      }
      
});
