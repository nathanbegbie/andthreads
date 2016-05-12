/**
 * Client-side jQuery library for LemonStand
 * Extends jQuery with two methods, `$.getForm` and `$.sendRequest`.
 */
(function ($, window, document) {
  var noop = function () {}
    , popup = function (res) { window.alert(res.message || "Request failed.") }

  function Request ($form, url, handler, opts)
  {
    this.form     = $form
    this.url      = url
    this.handler  = handler
    this.update   = opts.update || {}
    this.redirect = opts.redirect
    this.extraFields = opts.extraFields || {}

    // callback handlers
    this.onSuccess = opts.onSuccess || noop
    this.onFailure = opts.onFailure || popup
    this.onAfterUpdate = opts.onAfterUpdate || noop

    this.indicator   = opts.indicator || true
    this.indicatorId = opts.indicatorId
    this.indicatorText = opts.indicatorText
  }

  /**
   * Execute the request
   * @return {[type]} [description]
   */
  Request.prototype.do = function ()
  {
    var e = $.Event('onBeforeAjaxRequest')
    this.form.trigger(e)
    if (e.isDefaultPrevented()) 
        return

    var data = []
      , formData  = this.form.serialize()
      , extraData = $.param(this.extraFields)

    if (formData) data.push(formData)
    if (extraData) data.push(extraData)

    // options object
    var opts = {
      data : data.join('&')
    , type : this.form.attr('method') || 'post'
    , url  : this.url
    , headers: {
        'X-Event-Handler': this.handler
      , 'X-Partials'     : this.partials()
      }
    }

    // call xhr
    $.ajax(opts)
      .done(this.done.bind(this))
      .fail(this.fail.bind(this))

    this.showLoadingIndicator()
  }

  /**
   * done handler
   * @param  {[type]}   res response object
   */
  Request.prototype.done = function (res, status, xhr)
  {
    this.hideLoadingIndicator()

    // redirect client
    var redirect = res.redirect || this.redirect
    if (redirect) return window.location = redirect

    // callback & event
    $('span.error, small.error', this.form).text('');
    $("*[name]", this.form).removeClass("error")

    this.onSuccess(res, status, xhr)
    $(window).trigger('onAjaxSuccess', [res, status, xhr, this.handler, this.form])
    this.form.trigger('onSuccess', [res, status, xhr, this.handler, this.form])

    this.updatePartials(res)
    $(window).trigger('onAjaxAfterUpdate', [res, status, xhr, this.handler, this.form])
  }

  /**
   * fail handler
   * @param  {[type]} xhr    xhr object
   * @param  {[type]} status Text status
   * @param  {[type]} err    Error
   */
  Request.prototype.fail = function (xhr, status, err)
  {
    this.hideLoadingIndicator()

    // response
    var res = $.parseJSON(xhr.responseText),
        ignoreValidationMessage = false;

    //mark form fields that errored
    //var validationError = xhr.getResponseHeader('LS-Validation-Error')
    $('span.error, small.error', this.form).text('');
    $("*[name]", this.form).removeClass("error")

    var validationError = res.validationError;
    if (validationError) {
      var valError = JSON.parse(validationError)
      $.each(valError, function(name, val) {
        $('*[name="'+name+'"]', this.form).addClass('error');

         $('*[name="'+name+'"] + span.error, *[name="'+name+'"] + small.error', this.form).text(val);

        var parent = $('*[name="'+name+'"]', this.form).parent()
        if (parent.data('validation-parent') !== undefined)
          $('span.error, small.error', parent).text(val);
      });

      var validationMessage = this.form.data('validation-message');
      if (validationMessage !== undefined) {
        if (validationMessage.length === 0)
          ignoreValidationMessage = true;
        else
          res.message = validationMessage;
      }
    }

    if (!ignoreValidationMessage)
      this.onFailure(res, status, xhr)

    $('input.error', this.form).first().focus();

    this.form.trigger('onAjaxError')

    $(window)
      .trigger("onAfterAjaxError")
      .trigger("onAjaxFailure", res)
  }

  Request.prototype.partials = function ()
  {
    var update = this.update
      , partials = []

    for (var i in update) {
      partials.push(update[i])
    }
    return partials.join(',')
  }

  Request.prototype.updatePartials = function (res)
  {
    var update = this.update

    // TODO handle malformed response, handle missing partial 
    if ('undefined' === typeof res) return;

    // replace each partial
    for (var i in update) {
      $(i).html(res[update[i]])
          .trigger('onAfterUpdate')
    }

    this.onAfterUpdate(res);
    $(window).trigger('onAfterAjaxUpdate');
  }

  /**
   * Shows the loading indicator.
   * @type   Function
   * @return none
   */
  Request.prototype.showLoadingIndicator = function ()
  {
    if (!this.indicator) return

    var id = this.indicatorId || 'loading-indicator'
      , message = this.indicatorText || 'Loading...'
      , element = $('#' + id)

    if(!element.length) {
      element = $('<div class="ls-loading-indicator" id=' + id + '><span>'+message+'</span></div>')
      $('body').append(element)
    }
    element.show()
  }

  /**
   * Hides the loading indicator.
   * @type Function
   * @return none
   */
  Request.prototype.hideLoadingIndicator = function ()
  {
    if (!this.indicator) return;

    var id = this.indicatorId || "loading-indicator"
      , element = $('#' + id)

    if (element) element.hide()
  }

  /**
   * Walks the DOM tree and returns the closest parent `form` element
   * @api    public
   * @return jQuery
   */
  function getForm () {
    return this.closest('form');
  }

  /**
   * Sends an XMLHttpRequest to LemonStand
   * @api    public
   * @param  String   url     Request destination (optional)
   * @param  String   handler AJAX handler to call on the server
   * @param  Object   options Options to customize the request
   * @return null
   */
  function sendRequest (url, handler, opts) {
    var $form = this.getForm()

    // assume url omitted if only two args provided
    if (!opts) {
      opts    = handler || {}
      handler = url
      url     = $form.attr('action')
    }
    var req = new Request($form, url, handler, opts)
    req.do()
  }

  // jQuery plugin
  $.fn.getForm     = getForm
  $.fn.sendRequest = sendRequest

})(jQuery, window, document);

/*
 * LemonStand data attributes: data-ajax-update, data-ajax-extra-fields, data-ajax-redirect, data-ajax-handler
 */

function LSHandleAjaxData(element) {
  var $element = $(element)
    , extraFields = {}
    , update = {}

  if ($element.data('ajax-update')) {
    var idsPartials = $element.data('ajax-update').split(',');

      for (var index in idsPartials) {
        var 
          idPartial = idsPartials[index],
          info = idPartial.split('=');

        if (info.length != 2) {
          alert('Invalid AJAX update specifier syntax: ' + idPartial);
          return;
        }

        update[info[0].trim()] = info[1].trim();
      }
  }

  if ($element.data('ajax-extra-fields')) {
    var fieldsValues = $element.data('ajax-extra-fields').split(',');

    for (var index in fieldsValues) {
      var 
        fieldValue = fieldsValues[index],
        info = fieldValue.split('=');

      if (info.length != 2) {
        alert('Invalid AJAX extra field specifier syntax: ' + fieldValue);
        return;
      }

      extraFields[info[0].trim()] = info[1].trim().replace(/^'/, '').replace(/'$/, '');
    }
  }

  var options = {'update' : update, 'extraFields' : extraFields};
  if ($element.data('ajax-redirect')) {
    options.redirect = $element.data('ajax-redirect');
  }

  $element.sendRequest($element.data('ajax-handler'), options);
}

$(document).on('change', 'select[data-ajax-handler], input[type=radio][data-ajax-handler], input[type=checkbox][data-ajax-handler], input[type=text][data-ajax-handler]', function(){
  LSHandleAjaxData(this);
});
$(document).on('click', 'a[data-ajax-handler], input[type=button][data-ajax-handler], input[type="submit"][data-ajax-handler]', function(){
  LSHandleAjaxData(this);
  return false;
});
$(document).on('submit', '[data-ajax-handler]', function(){
  LSHandleAjaxData(this);
  return false;
});

/*
 * Magical country state list updating. Data attributes: data-state-selector, data-selected-state, data-states-partial
 */
$(document).on('change', '[data-state-selector]', function(){
  var 
    stateSelector = $(this).data('state-selector');
    updateList = {};
    
  var partial = $(this).data('states-partial');
  if (partial === undefined)
    partial = 'shop-stateoptions';

  updateList[stateSelector] = partial;

  $(this).sendRequest('shop:onUpdateStateList', {
      extraFields: {
        country_id: $(this).val(),
        current_state: $(this).data('selected-state')
      },
      update: updateList
  });
});
