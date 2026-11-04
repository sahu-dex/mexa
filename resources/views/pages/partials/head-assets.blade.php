<meta name="csrf-token" content="{{ csrf_token() }}">
<link rel="stylesheet" href="{{ asset('css/mobile-menu.css') }}">
<link rel="stylesheet" href="{{ asset('css/site-typography.css') }}">
<link rel="stylesheet" href="{{ asset('css/header-restoration.css') }}?v={{ filemtime(public_path('css/header-restoration.css')) }}">
<link rel="stylesheet" href="{{ asset('css/video-preview.css') }}">
@if ($page === 'home')
    <link rel="stylesheet" href="{{ asset('css/home-hero.css') }}?v={{ filemtime(public_path('css/home-hero.css')) }}">
@endif
