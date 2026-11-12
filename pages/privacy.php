<?php
declare(strict_types=1);

if (PHP_SAPI !== 'cli' && isset($_SERVER['SCRIPT_FILENAME']) && realpath($_SERVER['SCRIPT_FILENAME']) === __FILE__) {
    http_response_code(403);
    exit('Forbidden');
}

require_once dirname(__DIR__) . '/includes/functions.php';

$pageKey = 'privacy';
$pageTitle = 'Privacy Policy | ' . setting('site_name', 'Mexa Motion');
$pageDescription = 'How Mexa Motion collects, uses and protects the information you share when you book a service, send a review or subscribe to the newsletter.';

$siteName = setting('site_name', 'Mexa Motion');
$supportEmail = setting_raw('contact_email', '') ?: setting_raw('email', '');
$supportEmail = ($supportEmail !== '' && strpos($supportEmail, 'example.com') === false) ? $supportEmail : '';

$supportTg = 'https://t.me/Osman_Graphice';
$supportWa = 'https://wa.me/8801575715571';
$supportFb = 'https://www.facebook.com/mexamotion';

$lastUpdated = '12 November 2026';

include dirname(__DIR__) . '/includes/header.php';
?>
        <main class="legal">
            <div class="legal-wrap">
                <article class="legal-doc">
                    <h1>Privacy Policy</h1>
                    <p class="legal-meta">Last updated: <?= e($lastUpdated) ?></p>

                    <p class="legal-intro">
                        This page explains what <?= e($siteName) ?> collects when you visit this website, book a service,
                        leave a review or subscribe to our newsletter, and how we keep that information safe.
                    </p>

                    <h2>1. Who we are</h2>
                    <p>
                        <?= e($siteName) ?> is a video editing and motion graphics studio. We edit long-form videos, YouTube
                        content, shorts and reels, thumbnails, brand films, social ads and product videos for creators,
                        businesses and agencies.
                    </p>
                    <p>
                        For the personal information described here, <?= e($siteName) ?> is the data controller. You can reach us
                        at any time through the contact details at the end of this page.
                    </p>

                    <h2>2. What we collect</h2>
                    <p>We only ask for what we need to answer you and deliver the work you request.</p>
                    <h3>Information you give us</h3>
                    <ul>
                        <li><strong>Booking details</strong> — the service and package you select, the message you write about your project, and any email address, WhatsApp number, deadline or reference links you include in it.</li>
                        <li><strong>Contact details</strong> — anything you send us through Telegram, WhatsApp, Facebook or email, such as your name and how we can reply.</li>
                        <li><strong>Reviews</strong> — the name or alias, star rating and text you submit on our review page. Reviews are published only after moderation.</li>
                        <li><strong>Newsletter</strong> — the email address you submit in the footer subscription form. We use it only to send editing tips, offers and studio updates.</li>
                        <li><strong>Project files</strong> — footage, brand assets and briefs you share with us for an active project.</li>
                    </ul>
                    <h3>Information collected automatically</h3>
                    <ul>
                        <li>Technical data such as browser and device type, approximate location derived from your IP address, the pages you view and the date and time of your visit.</li>
                        <li>A session cookie that protects the booking form against cross-site request forgery, and an anti-spam check that blocks automated submissions.</li>
                    </ul>
                    <p class="legal-callout">
                        We never ask for passwords, card numbers or identity documents through the website forms. If somebody
                        asks you for them in our name, please report it to us immediately.
                    </p>

                    <h2>3. How we use it</h2>
                    <ul>
                        <li>To confirm your booking ticket, quote a scope and reply with the next steps.</li>
                        <li>To produce, revise and deliver the edit you ordered, and to keep a record of the agreed package.</li>
                        <li>To publish a review you submitted once our team has approved it.</li>
                        <li>To send the newsletter you opted into — every message includes an unsubscribe option.</li>
                        <li>To keep the site secure, prevent spam and understand which pages and services people look for.</li>
                        <li>To meet accounting, tax and legal record-keeping duties.</li>
                    </ul>
                    <p>
                        We rely on your consent for the newsletter, on the performance of our agreement for booked work, and
                        on our legitimate interest in keeping the website safe and improving our services.
                    </p>

                    <h2>4. Cookies and local storage</h2>
                    <p>
                        This website uses a small number of first-party cookies and browser storage entries. We do not run
                        advertising networks or sell audience data.
                    </p>
                    <ul>
                        <li><strong>Session cookie</strong> — required for the booking and review forms to work safely.</li>
                        <li><strong>Preference storage</strong> — remembers simple choices such as the language you picked, so the site does not reset them on every page.</li>
                        <li><strong>Security storage</strong> — short-lived tokens that stop duplicate or automated form submissions.</li>
                    </ul>
                    <p>
                        You can clear cookies and site data from your browser settings at any time. Blocking the session
                        cookie will stop the booking form from submitting.
                    </p>

                    <h2>5. Sharing and third parties</h2>
                    <p>We do not sell, rent or trade your information. We share it only with:</p>
                    <ul>
                        <li><strong>Service providers</strong> — the hosting, database and email delivery providers that run this website and the newsletter, under confidentiality obligations.</li>
                        <li><strong>Payment and accounting tools</strong> — the providers we use to invoice a confirmed project, where a project requires them.</li>
                        <li><strong>Platforms you choose</strong> — if you tap a Telegram, WhatsApp or Facebook button on this site, that platform handles the conversation under its own privacy policy.</li>
                        <li><strong>Authorities</strong> — where a valid legal request or court order requires disclosure.</li>
                    </ul>
                    <p>
                        Some of these providers process data outside your country. Where that happens, we rely on their
                        standard contractual safeguards for international transfers.
                    </p>

                    <h2>6. How long we keep data</h2>
                    <ul>
                        <li><strong>Booking tickets</strong> — kept while the project is active and for up to 24 months afterwards so we can handle follow-ups and repeat work.</li>
                        <li><strong>Project files</strong> — kept for up to 90 days after final delivery, then deleted unless you ask us to keep them longer.</li>
                        <li><strong>Newsletter email</strong> — kept until you unsubscribe or ask us to remove it.</li>
                        <li><strong>Reviews</strong> — kept while they are published, and removed on request.</li>
                        <li><strong>Invoices and tax records</strong> — kept for the period required by accounting law.</li>
                    </ul>

                    <h2>7. Your rights</h2>
                    <p>You can ask us to:</p>
                    <ul>
                        <li>confirm what personal information we hold about you and send you a copy;</li>
                        <li>correct anything that is wrong or out of date;</li>
                        <li>delete information we no longer need, including a published review or newsletter subscription;</li>
                        <li>stop using your information for the newsletter, or withdraw that consent at any time;</li>
                        <li>explain how a decision about your data was made.</li>
                    </ul>
                    <p>
                        Write to us through any channel listed below and we will respond within 30 days. We may ask a question
                        or two to make sure the request really comes from you.
                    </p>

                    <h2>8. Data security</h2>
                    <p>
                        The website runs over an encrypted connection, forms are protected against cross-site forgery and spam,
                        and access to the booking database is limited to the founder and the team members who need it to deliver
                        your project. No system is perfect — if a breach ever affects your information, we will tell you what
                        happened and what we did about it.
                    </p>

                    <h2>9. Children and minors</h2>
                    <p>
                        Our services and this website are intended for people aged 18 and over. We do not knowingly collect
                        information from children. If a booking was submitted by a minor, or you believe we hold a child's data,
                        contact us and we will delete it.
                    </p>

                    <h2>10. Changes to this policy</h2>
                    <p>
                        When our tools or the law change, we update this page and move the "last updated" date at the top.
                        Material changes are announced on the site. Continuing to use the website after an update means you
                        accept the revised policy.
                    </p>

                    <h2>11. Contact us</h2>
                    <p>Questions about this policy, or a request about your own data? Message us directly — a real person from the studio replies.</p>
                    <ul>
                        <li>WhatsApp: <a href="<?= e($supportWa) ?>" target="_blank" rel="noopener">wa.me/8801575715571</a></li>
                        <li>Telegram: <a href="<?= e($supportTg) ?>" target="_blank" rel="noopener">t.me/Osman_Graphice</a></li>
                        <li>Facebook: <a href="<?= e($supportFb) ?>" target="_blank" rel="noopener">facebook.com/mexamotion</a></li>
<?php if ($supportEmail !== ''): ?>
                        <li>Email: <a href="mailto:<?= e($supportEmail) ?>"><?= e($supportEmail) ?></a></li>
<?php endif; ?>
                    </ul>

                    <hr>
                    <p class="legal-back">
                        <a href="index.php">Back to home</a> &nbsp;·&nbsp; <a href="terms.php">Terms of Service</a> &nbsp;·&nbsp; <a href="book.php">Book a service</a>
                    </p>
                </article>
            </div>
        </main>
<?php include dirname(__DIR__) . '/includes/footer.php'; ?>
