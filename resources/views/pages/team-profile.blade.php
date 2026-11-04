<!doctype html>
<html lang="en">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta name="csrf-token" content="{{ csrf_token() }}">
    <title>Submit profile update | MEXA MOTION</title>
    <link rel="stylesheet" href="{{ asset('css/site-typography.css') }}">
    <link rel="stylesheet" href="{{ asset('css/team-profile.css') }}">
</head>
<body class="team-profile-page">
    <main class="profile-shell">
        <a class="profile-brand" href="{{ url('/') }}"><span>M</span><strong>MEXA MOTION</strong></a>
        <section class="profile-card">
            <p class="profile-eyebrow">TEAM MEMBER PROFILE</p>
            <h1>Suggest a profile update</h1>
            <p class="profile-intro">Update your information below. Your live profile stays as it is until the MEXA MOTION team approves this submission.</p>
            <form id="team-profile-form">
                @csrf
                <div class="profile-grid">
                    <label>Full name<input name="name" value="{{ $member['name'] ?? '' }}" maxlength="120" required></label>
                    <label>Designation<input name="designation" value="{{ $member['designation'] ?? $member['role'] ?? '' }}" maxlength="160"></label>
                    <label class="profile-wide">Profile photo URL<input name="photo_url" type="url" value="{{ $member['photo_url'] ?? '' }}" maxlength="2048" placeholder="https://…"></label>
                    <label class="profile-wide">Short bio<textarea name="bio" rows="3" maxlength="3000">{{ $member['bio'] ?? '' }}</textarea></label>
                    <label class="profile-wide">About you<textarea name="description" rows="5" maxlength="5000">{{ $member['description'] ?? '' }}</textarea></label>
                    <label class="profile-wide">Skills (one per line)<textarea name="skills" rows="3">{{ implode("\n", $member['skills'] ?? []) }}</textarea></label>
                    <label>LinkedIn<input name="linkedin" type="url" value="{{ $member['linkedin'] ?? '' }}"></label>
                    <label>Facebook<input name="facebook" type="url" value="{{ $member['facebook'] ?? '' }}"></label>
                    <label>Instagram<input name="instagram" type="url" value="{{ $member['instagram'] ?? '' }}"></label>
                    <label>YouTube<input name="youtube" type="url" value="{{ $member['youtube'] ?? '' }}"></label>
                    <label>Website<input name="website" type="url" value="{{ $member['website'] ?? '' }}"></label>
                    <label class="profile-wide">Responsibilities (one per line)<textarea name="responsibilities" rows="3">{{ implode("\n", $member['responsibilities'] ?? []) }}</textarea></label>
                    <label>WhatsApp<input name="whatsapp" value="{{ $member['whatsapp'] ?? '' }}" maxlength="80"></label>
                    <label>Telegram link<input name="telegram" value="{{ $member['telegram'] ?? '' }}" maxlength="500"></label>
                    <label>Phone<input name="phone" value="{{ $member['phone'] ?? '' }}" maxlength="80"></label>
                    <label>Email<input name="email" type="email" value="{{ $member['email'] ?? '' }}" maxlength="190"></label>
                </div>
                <button type="submit">Send for approval <span>→</span></button>
                <p id="profile-status" class="profile-status" role="status"></p>
            </form>
        </section>
        <p class="profile-note">This private link is managed by your website administrator. Do not share it publicly.</p>
    </main>
    <script>
        document.getElementById('team-profile-form').addEventListener('submit', async (event) => {
            event.preventDefault();
            const form = event.currentTarget;
            const data = Object.fromEntries(new FormData(form).entries());
            data.skills = (data.skills || '').split(/\r?\n/).map((value) => value.trim()).filter(Boolean);
            data.responsibilities = (data.responsibilities || '').split(/\r?\n/).map((value) => value.trim()).filter(Boolean);
            data.role = data.designation || '';
            const status = document.getElementById('profile-status');
            status.textContent = 'Sending your update…';
            try {
                const response = await fetch(@js(url('/api/public/team-profile/'.$token)), {
                    method: 'POST',
                    headers: { 'Accept': 'application/json', 'Content-Type': 'application/json', 'X-CSRF-TOKEN': form.querySelector('[name=_token]').value },
                    body: JSON.stringify(data),
                });
                const result = await response.json();
                if (!response.ok) throw new Error(result.message || 'Could not submit your update. Check the fields and retry.');
                form.reset();
                status.textContent = result.message;
            } catch (error) { status.textContent = error.message; }
        });
    </script>
</body>
</html>
