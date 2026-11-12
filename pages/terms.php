<?php
declare(strict_types=1);

if (PHP_SAPI !== 'cli' && isset($_SERVER['SCRIPT_FILENAME']) && realpath($_SERVER['SCRIPT_FILENAME']) === __FILE__) {
    http_response_code(403);
    exit('Forbidden');
}

require_once dirname(__DIR__) . '/includes/functions.php';

$pageKey = 'terms';
$pageTitle = 'Terms of Service | ' . setting('site_name', 'Mexa Motion');
$pageDescription = 'The rules for booking, paying for and receiving video editing and motion graphics work from Mexa Motion: scope, revisions, delivery, ownership and refunds.';

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
                    <h1>Terms of Service</h1>
                    <p class="legal-meta">Last updated: <?= e($lastUpdated) ?></p>

                    <p class="legal-intro">
                        These terms explain how bookings, prices, revisions, delivery and payments work when you order editing
                        from <?= e($siteName) ?>. Please read them before you submit a booking ticket.
                    </p>

                    <h2>1. Agreement</h2>
                    <p>
                        By submitting a booking ticket, ordering an edit or using this website, you agree to these terms. If you
                        are ordering on behalf of a company or client, you confirm you are allowed to accept them for that
                        organisation.
                    </p>
                    <p>
                        If anything here is unclear, message us before ordering — we would rather clear it up first than argue
                        about it later.
                    </p>

                    <h2>2. Our services</h2>
                    <p><?= e($siteName) ?> provides remote post-production services, including:</p>
                    <ul>
                        <li>professional video editing, YouTube editing, shorts and reels;</li>
                        <li>motion graphics and animated titles;</li>
                        <li>thumbnail design, brand videos, social media ads and product videos.</li>
                    </ul>
                    <p>
                        Each service is offered in package levels (for example Normal, High and Premium) that differ in
                        revisions, delivery time and price. The exact contents of the package you pick are shown on the booking
                        page and confirmed in your ticket.
                    </p>

                    <h2>3. Booking and confirmation</h2>
                    <ul>
                        <li>A booking ticket is a <strong>request</strong>, not a confirmed order. You receive a unique ticket reference as soon as you submit it.</li>
                        <li>The founder reviews every ticket and confirms scope, timeline and price before any work starts.</li>
                        <li>A project becomes binding when we confirm the ticket and the agreed advance or full payment has been received.</li>
                        <li>If a request falls outside what we do, or the deadline is not achievable, we will say so instead of taking the job.</li>
                    </ul>

                    <h2>4. Pricing and payment</h2>
                    <ul>
                        <li>Prices on the website are shown in US dollars and are starting points per project, not per minute or per revision.</li>
                        <li>A quote may change if the brief, footage volume or deadline changes after confirmation.</li>
                        <li>Unless agreed otherwise, a project is paid in advance, or in milestones for larger jobs (for example 50% to start and 50% before final delivery).</li>
                        <li>Bank, wallet or transfer fees are the client's responsibility, and any applicable taxes are added where the law requires them.</li>
                        <li>Work on a milestone does not begin until that milestone is paid.</li>
                    </ul>

                    <h2>5. Your responsibilities</h2>
                    <ul>
                        <li><strong>Supply the material.</strong> Send the raw footage, logo, brand fonts, references and brief through the channel we agree on, within the timeline set for the project.</li>
                        <li><strong>Own what you send.</strong> You confirm you hold the rights to all footage, music, images and logos you provide, and that our use of them does not infringe anyone else's rights.</li>
                        <li><strong>Respond on time.</strong> Revision notes and approvals should come back within the agreed feedback window. Silence beyond that may push the delivery date.</li>
                        <li><strong>One point of contact.</strong> Where a project has several stakeholders, nominate one person to collect and send consolidated feedback.</li>
                    </ul>

                    <h2>6. Revisions and scope</h2>
                    <p>
                        Each package includes a defined number of revision rounds: Normal typically one, High three, and Premium
                        unlimited within fair use. A revision is a reasonable adjustment to the edit already delivered — trimming
                        a scene, changing a title, swapping a clip, adjusting music or colour.
                    </p>
                    <ul>
                        <li>A new concept, a new structure, a different video, or re-editing footage that was not in the original brief counts as new work and is quoted separately.</li>
                        <li>"Unlimited" revisions in the Premium package are meant for normal creative refinement; it is not a licence to restart the project repeatedly.</li>
                        <li>Extra rounds beyond your package are billed per round, and we always tell you the price before starting.</li>
                    </ul>

                    <h2>7. Turnaround and delivery</h2>
                    <ul>
                        <li>Delivery windows shown on the packages (for example 1–2, 2–3 or 3–4 business days) start when we have both the payment and the complete material.</li>
                        <li>Weekends and public holidays are not counted as business days, and delays caused by missing feedback move the delivery date by the same amount.</li>
                        <li>Final files are delivered digitally, normally as a download link in the format agreed (for example 1080p or 4K MP4, plus project-specific exports).</li>
                        <li>Delivery links stay available for 7 days. Please download and archive your files — long-term storage is not part of the service.</li>
                    </ul>

                    <h2>8. Ownership and licences</h2>
                    <ul>
                        <li>Once the project is paid in full, you receive the rights to use the final delivered video for the purposes agreed in the brief.</li>
                        <li>Working files, project timelines and unused cuts remain the property of <?= e($siteName) ?> unless we agree otherwise in writing.</li>
                        <li>We may show the finished work in our portfolio, showreel and social channels. Tell us before the project starts if it must stay confidential, and we will keep it private.</li>
                        <li>Third-party assets such as stock footage, music or fonts are licensed under their own terms. Where a project needs them, we tell you the licence and its limits.</li>
                    </ul>

                    <h2>9. Cancellations and refunds</h2>
                    <ul>
                        <li><strong>Before work starts</strong> — cancel in writing and we refund the amount paid, minus any transfer or platform fees already incurred.</li>
                        <li><strong>After work has started</strong> — the portion of work completed is charged and the remainder is refunded.</li>
                        <li><strong>After final delivery</strong> — payments are non-refundable. If something is not right, use your included revision rounds and we will fix it.</li>
                        <li>Cancellations caused by missing footage, missing feedback or a change of direction from your side are handled under the same pro-rata rule.</li>
                    </ul>
                    <p>
                        Refunds are returned through the same method you paid with, usually within 7 business days of approval.
                    </p>

                    <h2>10. Acceptable use</h2>
                    <p>
                        We do not edit or promote content that is unlawful, hateful, harassing, sexually exploitative of minors,
                        or that infringes someone else's copyright. We may decline or stop a project that turns out to involve
                        such material, and no refund is owed for work already completed.
                    </p>

                    <h2>11. Liability</h2>
                    <ul>
                        <li>We deliver work with professional care, but we cannot guarantee views, sales, subscribers or any commercial outcome.</li>
                        <li>Our total liability for any project is limited to the fee you paid for that project.</li>
                        <li>We are not liable for indirect or consequential losses, or for losses caused by material you supplied without the necessary rights.</li>
                        <li>Keep your own backup of every file you send us. We are not responsible for lost footage that only existed in our transfer link.</li>
                    </ul>

                    <h2>12. Termination</h2>
                    <p>
                        Either side may end a project with written notice. If we end it for reasons within our control, you are
                        refunded for work not yet completed. If it ends because of a breach of these terms — for example an unpaid
                        milestone or unlawful material — work stops immediately and the amounts already earned stay payable.
                    </p>

                    <h2>13. Governing law</h2>
                    <p>
                        These terms are governed by the laws of Bangladesh, and disputes are handled by the courts of Chattogram.
                        Before anything formal, write to us — almost every disagreement is solved with a conversation and a
                        revision.
                    </p>

                    <h2>14. Changes to these terms</h2>
                    <p>
                        We may update these terms as our services evolve. The version in force is the one published on this page
                        when you submit your ticket, and the "last updated" date at the top always shows the current version.
                    </p>

                    <h2>15. Contact us</h2>
                    <p>Questions about a quote, a deadline or anything in these terms? Reach the studio directly.</p>
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
                        <a href="index.php">Back to home</a> &nbsp;·&nbsp; <a href="privacy.php">Privacy Policy</a> &nbsp;·&nbsp; <a href="book.php">Book a service</a>
                    </p>
                </article>
            </div>
        </main>
<?php include dirname(__DIR__) . '/includes/footer.php'; ?>
