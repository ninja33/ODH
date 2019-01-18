function spell() {
	let exec = (command, value=null) => document.execCommand(command, false, value)
	let ensureHTTP = url => /^https?:\//.test(url) ? url : `http://${url}`
	let $ = (tag, props, children=[], elm=document.createElement(tag)) =>
		children.map(child => child && elm.appendChild(child)) && Object.assign(elm, props)

	let colorPicker = _=> $('input', { type: 'color' })
	let select = options => $('select', {}, options.map(o => $('option', { textContent:o })))

	let buttons = {};
	let queryState = _=> {
		for(let cmd in buttons)
			buttons[cmd].classList.toggle('selected', document.queryCommandState(cmd))
	}

	let actions = [
		[
			['bold'],
			['italic'],
			['underline']
		],
		[
			['paragraph', '<p>'],
			['quote', '<blockquote>'],
			['code', '<pre>']
		].map(([title, format]) => [title, _=> exec('formatBlock', format)]),
		[
			['insertOrderedList'],
			['insertUnorderedList'],
			['insertHorizontalRule'],
		],
		[
			['removeFormat'],
			['unlink']
		],
		[
			['createLink', 'link', ensureHTTP],
			['insertImage','image', ensureHTTP]
		].map(([cmd, type, t]) => [type, url => (url=prompt(`Enter the ${type} URL`)) && exec(cmd, t(url))]),
		[
			['undo'],
			['redo']
		]
	]

	return $('div', { className: 'spell' }, [
		$('div', { className: 'spell-bar' }, actions.map(
			bar => $('div', { className: 'spell-zone' }, bar.map(
				([cmd, onclick = _=> exec(cmd), control]) => buttons[cmd] = $('button', {
					className: 'spell-icon',
					title: cmd.replace(/([^a-z])/g, ' $1').toLowerCase(),
					onclick
				}, [$('i', { className: 'icon-'+cmd.toLowerCase() }), control])
			))
		)),
		$('div', {
			className: 'spell-content',
			contentEditable: true,
			onkeydown: event => event.which !== 9,
			onkeyup: queryState,
			onmouseup: queryState
		})
	])
}