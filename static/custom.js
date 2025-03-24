$(document).ready(function () {
    console.log("jQuery version:", $.fn.jquery); // Check jQuery version
    console.log("jQuery UI version:", $.ui ? $.ui.version : "jQuery UI not loaded"); // Check jQuery UI version

    $('.modal').modal();

    let resultsData = [];
    let searchQuery = '';
    let totalFrequency = 0;
    let selectedRow = null;

    $('.modal').modal();

    function getSearchResults(page, callback) {

        let query = $('#search').val();
        let context_window = Number($('input[name="range"]:checked').val());
        let match_type = $('input[name="search-type"]:checked').val();
        let explicit = $('input[name="explicit-filtering"]:checked').val();
        let checkboxResults = getCheckboxValues();
        let errorEditing = checkboxResults['errorEditing'];
        let removePunctuations = checkboxResults['removePunctuations'];
        let removeEmojis = checkboxResults['removeEmojis']
        
        $.ajax({
            url: '/search',
            method: 'GET',
            data: { 
                q: query, page: page, 
                context_window: context_window, 
                match_type: match_type,
                explicit: explicit,
                error_editing: errorEditing,
                remove_punctuations: removePunctuations,
                remove_emojis: removeEmojis,
            },
            success: function (response) {
                searchQuery = query;
                resultsData = response.results; // Store results in the global variable
                totalFrequency = response.total_frequency;
                corpusLength = response.corpus_length
                joinedSetences = response.joined_setences
                tokenDic = response.token_dic, 
                tagDic = response.tag_dic, 
                lemmaDic = response.lemma_dic
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
        let context_window = Number($('input[name="range"]:checked').val());
        let headers = convertNumberToList(context_window);

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
            const rightContext = result.context.slice(0, context_window);
            const kwic = result.context[context_window];
            const leftContext = result.context.slice(context_window + 1);

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

        var totalPages = Math.ceil(response.total_frequency / response.per_page);
        var maxPagesToShow = 5;
        var startPage = Math.max(1, page - Math.floor(maxPagesToShow / 2));
        var endPage = Math.min(totalPages, startPage + maxPagesToShow - 1);

        if (page > 1) {
            pagination.append('<li class="waves-effect"><a href="#" data-page="1"><i class="material-icons">first_page</i></a></li>');
            pagination.append('<li class="waves-effect"><a href="#" data-page="' + (page - 1) + '"><i class="material-icons">chevron_left</i></a></li>');
        } else {
            pagination.append('<li class="disabled"><a href="#"><i class="material-icons">first_page</i></a></li>');
            pagination.append('<li class="disabled"><a href="#"><i class="material-icons">chevron_left</i></a></li>');
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
            pagination.append('<li class="disabled"><a href="#"><i class="material-icons">chevron_right</i></a></li>');
            pagination.append('<li class="disabled"><a href="#"><i class="material-icons">last_page</i></a></li>');
        }
    }

    function calculateFrequency() {
        $('#dynamic-content').html(
            `<h4>Frequency Information</h4>
            <hr>
            <table>
                <tbody>
                    <tr>
                        <td>Query:</td>
                        <td>${searchQuery}</td>
                    </tr>
                    <tr>
                        <td>Lemmas:</td>
                        <td>${Object.keys(lemmaDic).join('، ')}</td>
                    </tr>
                    <tr>
                        <td>Tags:</td>
                        <td>${Object.keys(tagDic).join('، ')}</td>
                    </tr>
                    <tr>
                        <td>Frequency:</td>
                        <td>${totalFrequency}</td>
                        <td>per thousand tokens:</td>
                        <td>${totalFrequency/1000}</td>
                        <td>Percentage:</td>
                        <td>${(totalFrequency/corpusLength*100).toFixed(2)}</td>
                    </tr>
                </tbody>
            </table>
            `);
        $('#dynamic-content-modal').modal('open');
    }

    $('#search-btn').on('click', function () {
        getSearchResults(1, function(response) {
            displaySearchResults(response, 1);
        });
    });

    $('#search').on('keypress', function (e) {
        if (e.which === 13) {
            getSearchResults(1, function(response) {
                displaySearchResults(response, 1);
            });
        }
    });

    $(document).on('click', '#pagination a', function (e) {
        e.preventDefault();
        var page = $(this).data('page');
        getSearchResults(page, function(response) {
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
        const sentence = joinedSetences[index]['joined_setences'].replace(/\n/g, '<br>');
        $('#dynamic-content').html(`
            <div>
                <h4>The Full Tweet</h4>
                <hr>
                <p style="direction: rtl;">${sentence}</p>
            </div>`
        );
        $('#dynamic-content-modal').modal('open');
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

      function getCheckboxValues() {
        const errorEditingCheckbox = document.getElementById('error-editing-checkbox');
        const removePunctuationsCheckbox = document.getElementById('remove-punctuations-checkbox');
        const removeEmojisCheckbox = document.getElementById('remove-emojis-checkbox');
      
        const errorEditingValue = errorEditingCheckbox.checked ? errorEditingCheckbox.value : document.getElementById('error-editing-hidden').value;
        const removePunctuationsValue = removePunctuationsCheckbox.checked ? removePunctuationsCheckbox.value : document.getElementById('remove-punctuations-hidden').value;
        const removeEmojisValue = removeEmojisCheckbox.checked ? removeEmojisCheckbox.value : document.getElementById('remove-emojis-hidden').value;
        // Optionally, you can return these values as an object
        return {
          errorEditing: errorEditingValue,
          removePunctuations: removePunctuationsValue,
          removeEmojis: removeEmojisValue,
        };
    }
});
